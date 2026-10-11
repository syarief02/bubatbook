-- =====================================================================
-- Keep the counter record's name and email in the audit log (2026-10-12)
--
-- When a walk-in record is linked into a customer's online account, the
-- walk-in login (and its email) is removed. Staff may still need the email
-- the customer gave at the counter, e.g. to match old invoices, so the link
-- audit entry now records it. Same function as 20261012010000 otherwise.
-- =====================================================================

begin;

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
    jsonb_build_object(
      'walk_in_id', p_walk_in,
      'walk_in_name', v_match.display_name,
      'walk_in_email', v_match.email,
      'matched_by', p_matched_by,
      'bookings', v_bookings
    )
  );

  return jsonb_build_object(
    'status', 'linked',
    'bookings', v_bookings,
    'credit', coalesce(v_match.deposit_credit, 0),
    'verified', coalesce(v_match.is_verified, false)
  );
end;
$$;

revoke all on function public.bubatrent_merge_walk_in(uuid, uuid, text) from public, anon, authenticated;

commit;
