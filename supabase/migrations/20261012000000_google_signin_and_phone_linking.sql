-- =====================================================================
-- Google sign-in + linking admin-registered customers (2026-10-12)
--
-- * New profiles take the name Google provides (full_name / name).
-- * bubatrent_complete_phone_verification(): called right after the user
--   verifies their mobile by SMS. It copies the verified number to the
--   profile and, if exactly one admin-registered customer with that number
--   has never signed in, moves that customer's bookings, credit and verified
--   ID details into the caller's account and removes the placeholder login.
--
-- Email matches need no code here: Supabase links a Google login to an
-- existing account with the same confirmed email automatically.
--
-- Additive and safe to apply before the frontend ships.
-- =====================================================================

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.bubatrent_booking_profiles (id, username, display_name, phone, email)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'phone',
    new.email
  );
  return new;
end;
$$;

create or replace function public.bubatrent_complete_phone_verification()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_phone_confirmed timestamptz;
  v_digits text;
  v_me public.bubatrent_booking_profiles;
  v_match public.bubatrent_booking_profiles;
  v_matches integer;
  v_claimed integer;
  v_bookings integer;
  r record;
begin
  if v_uid is null then
    raise exception 'Please log in again.' using errcode = '28000';
  end if;

  -- Only the number Supabase Auth verified by SMS is trusted, never client input.
  select phone, phone_confirmed_at into v_phone, v_phone_confirmed
    from auth.users where id = v_uid;
  if coalesce(v_phone, '') = '' or v_phone_confirmed is null then
    raise exception 'Your mobile number is not verified yet.' using errcode = '22023';
  end if;
  v_digits := regexp_replace(v_phone, '\D', '', 'g');

  update public.bubatrent_booking_profiles
     set phone = '+' || v_digits
   where id = v_uid
  returning * into v_me;

  -- Admin-registered customers with this number, other than the caller
  select count(*) filter (where not exists (select 1 from auth.identities i where i.user_id = p.id)),
         count(*) filter (where exists (select 1 from auth.identities i where i.user_id = p.id))
    into v_matches, v_claimed
    from public.bubatrent_booking_profiles p
   where p.id <> v_uid
     and p.created_by_admin is not null
     and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = v_digits;

  if v_matches = 0 and v_claimed = 0 then
    return jsonb_build_object('status', 'verified');
  end if;
  if v_matches <> 1 or v_claimed > 0 then
    -- Several records, or one someone already signs in to: an admin decides.
    return jsonb_build_object('status', 'needs_admin');
  end if;

  select p.* into v_match
    from public.bubatrent_booking_profiles p
   where p.id <> v_uid
     and p.created_by_admin is not null
     and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = v_digits
     and not exists (select 1 from auth.identities i where i.user_id = p.id)
   for update;

  -- Never merge into an admin, or over identity details that disagree.
  if v_me.role <> 'customer'
     or coalesce(v_me.is_verified, false)
     or (v_me.ic_number is not null and v_me.ic_number is distinct from v_match.ic_number) then
    return jsonb_build_object('status', 'needs_admin');
  end if;

  select count(*) into v_bookings
    from public.bubatrent_booking_bookings where user_id = v_match.id;

  -- Re-point every row that references the walk-in user (bookings, credit
  -- ledger, agreements, verification updates, ...) to the caller.
  for r in
    select distinct c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and array_length(c.conkey, 1) = 1
       and c.connamespace = 'public'::regnamespace
       and c.confrelid in ('auth.users'::regclass, 'public.bubatrent_booking_profiles'::regclass)
       and c.conrelid <> 'public.bubatrent_booking_profiles'::regclass
  loop
    execute format('update %s set %I = $1 where %I = $2', r.tbl, r.col, r.col)
      using v_uid, v_match.id;
  end loop;

  -- Bring over the admin-verified identity details and the credit balance.
  update public.bubatrent_booking_profiles
     set display_name = coalesce(nullif(v_me.display_name, ''), v_match.display_name),
         ic_number = coalesce(v_match.ic_number, v_me.ic_number),
         licence_number = coalesce(v_match.licence_number, v_me.licence_number),
         licence_expiry = coalesce(v_match.licence_expiry, v_me.licence_expiry),
         gdl_license = coalesce(v_match.gdl_license, v_me.gdl_license),
         ic_file_path = coalesce(v_match.ic_file_path, v_me.ic_file_path),
         licence_file_path = coalesce(v_match.licence_file_path, v_me.licence_file_path),
         address_line1 = coalesce(v_match.address_line1, v_me.address_line1),
         address_line2 = coalesce(v_match.address_line2, v_me.address_line2),
         address_city = coalesce(v_match.address_city, v_me.address_city),
         address_state = coalesce(v_match.address_state, v_me.address_state),
         address_postcode = coalesce(v_match.address_postcode, v_me.address_postcode),
         city = coalesce(v_match.city, v_me.city),
         state = coalesce(v_match.state, v_me.state),
         postcode = coalesce(v_match.postcode, v_me.postcode),
         is_verified = coalesce(v_match.is_verified, false),
         verified_by = v_match.verified_by,
         verified_at = v_match.verified_at,
         created_by_admin = v_match.created_by_admin,
         deposit_credit = coalesce(v_me.deposit_credit, 0) + coalesce(v_match.deposit_credit, 0)
   where id = v_uid;

  -- The placeholder login (never used) goes; its profile is removed with it.
  delete from auth.users where id = v_match.id;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (
    null, 'LINK_WALK_IN_ACCOUNT', 'profile', v_uid,
    jsonb_build_object('walk_in_id', v_match.id, 'matched_by', 'verified_phone', 'bookings', v_bookings)
  );

  return jsonb_build_object(
    'status', 'linked',
    'bookings', v_bookings,
    'credit', coalesce(v_match.deposit_credit, 0),
    'verified', coalesce(v_match.is_verified, false)
  );
end;
$$;

revoke all on function public.bubatrent_complete_phone_verification() from public, anon;
grant execute on function public.bubatrent_complete_phone_verification() to authenticated;

commit;
