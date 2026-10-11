-- =====================================================================
-- Link walk-in customers by mobile number + IC number (2026-10-12)
--
-- Replaces the SMS-verified linking from 20261012000000 (SMS was too
-- costly). A customer's mobile number is not verified, so a number match
-- alone proves nothing; the link only happens when the customer also gives
-- the IC number the admin recorded.
--
-- * bubatrent_save_mobile(phone): saves the caller's mobile and says
--   whether an admin-registered customer with that number could be linked.
--   Never reveals anything about that customer.
-- * bubatrent_link_walk_in_by_ic(ic): links the walk-in record whose phone
--   AND IC match, moving its bookings, credit and verified details into the
--   caller's account. Guessing is limited to 5 wrong ICs per account and 10
--   per phone number per day.
--
-- Email matches need no code: Supabase links a Google login to an existing
-- account with the same confirmed email automatically.
-- =====================================================================

begin;

drop function if exists public.bubatrent_complete_phone_verification();

-- Digits only; Malaysian local numbers (01x...) become 601x...
create or replace function public.bubatrent_phone_digits(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when d like '0%' then '60' || substr(d, 2) else d end
    from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) s;
$$;

-- IC / passport numbers compared without dashes, spaces or case
create or replace function public.bubatrent_id_number_key(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_value, ''), '[^0-9A-Za-z]', '', 'g'));
$$;

-- Only the functions below read or write this; no policies on purpose.
create table if not exists public.bubatrent_booking_link_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('lookup', 'ic')),
  phone_digits text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.bubatrent_booking_link_attempts enable row level security;
create index if not exists bubatrent_link_attempts_user_idx
  on public.bubatrent_booking_link_attempts (user_id, created_at);
create index if not exists bubatrent_link_attempts_phone_idx
  on public.bubatrent_booking_link_attempts (phone_digits, created_at);

-- Moves everything that belongs to the walk-in user into p_target, copies
-- its verified details and credit, then removes the never-used walk-in login.
-- Internal: only callable from the SECURITY DEFINER functions below.
create or replace function public.bubatrent_merge_walk_in(
  p_target uuid,
  p_walk_in uuid,
  p_matched_by text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me public.bubatrent_booking_profiles;
  v_match public.bubatrent_booking_profiles;
  v_bookings integer;
  r record;
begin
  select * into v_me from public.bubatrent_booking_profiles where id = p_target;
  select * into v_match from public.bubatrent_booking_profiles where id = p_walk_in for update;

  select count(*) into v_bookings
    from public.bubatrent_booking_bookings where user_id = p_walk_in;

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
      using p_target, p_walk_in;
  end loop;

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
   where id = p_target;

  delete from auth.users where id = p_walk_in;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (
    null, 'LINK_WALK_IN_ACCOUNT', 'profile', p_target,
    jsonb_build_object('walk_in_id', p_walk_in, 'matched_by', p_matched_by, 'bookings', v_bookings)
  );

  return jsonb_build_object(
    'status', 'linked',
    'bookings', v_bookings,
    'credit', coalesce(v_match.deposit_credit, 0),
    'verified', coalesce(v_match.is_verified, false)
  );
end;
$$;

create or replace function public.bubatrent_save_mobile(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_digits text := public.bubatrent_phone_digits(p_phone);
  v_lookups integer;
  v_failed_for_phone integer;
  v_candidates integer;
begin
  if v_uid is null then
    raise exception 'Please log in again.' using errcode = '28000';
  end if;
  if length(v_digits) not between 9 and 15 then
    raise exception 'Please enter a valid mobile number.' using errcode = '22023';
  end if;

  update public.bubatrent_booking_profiles set phone = '+' || v_digits where id = v_uid;

  -- Limit lookups so this can't be used to find out which numbers are customers
  select count(*) into v_lookups
    from public.bubatrent_booking_link_attempts
   where user_id = v_uid and kind = 'lookup' and created_at > now() - interval '1 day';
  select count(*) into v_failed_for_phone
    from public.bubatrent_booking_link_attempts
   where phone_digits = v_digits and kind = 'ic' and not success
     and created_at > now() - interval '1 day';
  if v_lookups >= 10 or v_failed_for_phone >= 10 then
    return jsonb_build_object('status', 'saved', 'can_link', false);
  end if;
  insert into public.bubatrent_booking_link_attempts (user_id, kind, phone_digits)
  values (v_uid, 'lookup', v_digits);

  -- Admin-registered customers with this number who have never signed in
  select count(*) into v_candidates
    from public.bubatrent_booking_profiles p
   where p.id <> v_uid
     and p.created_by_admin is not null
     and public.bubatrent_phone_digits(p.phone) = v_digits
     and not exists (select 1 from auth.identities i where i.user_id = p.id);

  return jsonb_build_object('status', 'saved', 'can_link', v_candidates > 0);
end;
$$;

create or replace function public.bubatrent_link_walk_in_by_ic(p_ic_number text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ic text := public.bubatrent_id_number_key(p_ic_number);
  v_me public.bubatrent_booking_profiles;
  v_digits text;
  v_failed_me integer;
  v_failed_phone integer;
  v_matches integer;
  v_walk_in uuid;
begin
  if v_uid is null then
    raise exception 'Please log in again.' using errcode = '28000';
  end if;
  if length(v_ic) not between 6 and 20 then
    raise exception 'Please enter your IC number, e.g. 900101-14-5555.' using errcode = '22023';
  end if;

  select * into v_me from public.bubatrent_booking_profiles where id = v_uid;
  v_digits := public.bubatrent_phone_digits(v_me.phone);
  if v_digits = '' then
    raise exception 'Add your mobile number first.' using errcode = '22023';
  end if;

  select count(*) into v_failed_me
    from public.bubatrent_booking_link_attempts
   where user_id = v_uid and kind = 'ic' and not success
     and created_at > now() - interval '1 day';
  select count(*) into v_failed_phone
    from public.bubatrent_booking_link_attempts
   where phone_digits = v_digits and kind = 'ic' and not success
     and created_at > now() - interval '1 day';
  if v_failed_me >= 5 or v_failed_phone >= 10 then
    return jsonb_build_object('status', 'locked');
  end if;

  select count(*), min(p.id::text)::uuid into v_matches, v_walk_in
    from public.bubatrent_booking_profiles p
   where p.id <> v_uid
     and p.created_by_admin is not null
     and public.bubatrent_phone_digits(p.phone) = v_digits
     and public.bubatrent_id_number_key(p.ic_number) = v_ic
     and not exists (select 1 from auth.identities i where i.user_id = p.id);

  if v_matches = 0 then
    insert into public.bubatrent_booking_link_attempts (user_id, kind, phone_digits, success)
    values (v_uid, 'ic', v_digits, false);
    return jsonb_build_object('status', 'no_match', 'attempts_left', greatest(0, 4 - v_failed_me));
  end if;

  -- Several identical records, an admin account, or identity details that
  -- disagree with what this account already holds: leave it to an admin.
  if v_matches > 1
     or v_me.role <> 'customer'
     or (v_me.ic_number is not null and public.bubatrent_id_number_key(v_me.ic_number) <> v_ic) then
    return jsonb_build_object('status', 'needs_admin');
  end if;

  insert into public.bubatrent_booking_link_attempts (user_id, kind, phone_digits, success)
  values (v_uid, 'ic', v_digits, true);

  return public.bubatrent_merge_walk_in(v_uid, v_walk_in, 'phone_and_ic');
end;
$$;

revoke all on function public.bubatrent_phone_digits(text) from public, anon, authenticated;
revoke all on function public.bubatrent_id_number_key(text) from public, anon, authenticated;
revoke all on function public.bubatrent_merge_walk_in(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.bubatrent_save_mobile(text) from public, anon;
revoke all on function public.bubatrent_link_walk_in_by_ic(text) from public, anon;
grant execute on function public.bubatrent_save_mobile(text) to authenticated;
grant execute on function public.bubatrent_link_walk_in_by_ic(text) to authenticated;

commit;
