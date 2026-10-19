-- =====================================================================
-- Reviewing licence renewals and document updates (2026-10-19)
--
-- A verified customer whose licence expired (or who updates their IC or
-- licence) sends the new details from Verify Account. They were saved in
-- bubatrent_booking_verification_updates, but no admin screen read that
-- table, so a renewal was never reviewed and the customer stayed blocked.
-- The browser could also send a row already marked approved, or point at
-- files that weren't theirs.
--
-- Now:
--   * bubatrent_check_verification_update (BEFORE INSERT, website
--     requests): a new row is always pending and unreviewed; the licence
--     expiry must be today or later; a changed licence expiry needs a new
--     licence photo and a changed IC number a new IC photo; photos must be
--     the customer's own uploads (profiles/<id>/...) or the ones already on
--     their profile. One pending update per customer.
--   * rejection_reason, shown to the customer.
--   * bubatrent_admin_review_verification_update: an admin approves (the
--     new IC, licence and address go on the profile and the customer is
--     verified) or rejects with a reason, in one step, with an audit entry
--     (APPROVE_VERIFICATION_UPDATE / REJECT_VERIFICATION_UPDATE). The phone
--     number is not copied: it is changed from the profile, where it also
--     links counter records.
--
-- Deploy order: run before the frontend ships.
-- =====================================================================

begin;

alter table public.bubatrent_booking_verification_updates
  add column if not exists rejection_reason text;

create unique index if not exists bubatrent_one_pending_verification_update
  on public.bubatrent_booking_verification_updates (user_id)
  where status = 'pending';

create or replace function public.bubatrent_check_verification_update()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_profile public.bubatrent_booking_profiles;
begin
  -- Runs as the owner (to read the profile); the role setting still holds
  -- the request's role.
  if coalesce(current_setting('role', true), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  new.status := 'pending';
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.rejection_reason := null;
  new.created_at := now();

  select * into v_profile from public.bubatrent_booking_profiles where id = new.user_id;
  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  if new.licence_expiry is null or new.licence_expiry < v_today then
    raise exception 'Enter a licence expiry date that hasn''t passed.' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(new.ic_number, '')), '') is null then
    raise exception 'IC number is required.' using errcode = '22023';
  end if;

  -- Photos: the customer's own uploads, or the ones already on the profile
  if new.ic_file_path is not null
     and new.ic_file_path is distinct from v_profile.ic_file_path
     and new.ic_file_path not like 'profiles/' || new.user_id::text || '/%' then
    raise exception 'Invalid IC file.' using errcode = '22023';
  end if;
  if new.licence_file_path is not null
     and new.licence_file_path is distinct from v_profile.licence_file_path
     and new.licence_file_path not like 'profiles/' || new.user_id::text || '/%' then
    raise exception 'Invalid licence file.' using errcode = '22023';
  end if;

  -- A new expiry date needs a photo of the new licence; a new IC number a new IC photo
  if new.licence_expiry is distinct from v_profile.licence_expiry
     and (new.licence_file_path is null or new.licence_file_path is not distinct from v_profile.licence_file_path) then
    raise exception 'Please upload a photo of your new driving licence.' using errcode = '22023';
  end if;
  if btrim(new.ic_number) is distinct from v_profile.ic_number
     and (new.ic_file_path is null or new.ic_file_path is not distinct from v_profile.ic_file_path) then
    raise exception 'Please upload a photo of your IC for the new IC number.' using errcode = '22023';
  end if;
  new.ic_number := btrim(new.ic_number);

  if exists (
    select 1 from public.bubatrent_booking_verification_updates
     where user_id = new.user_id and status = 'pending'
  ) then
    raise exception 'Your last update is still being reviewed.' using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists bubatrent_check_verification_update on public.bubatrent_booking_verification_updates;
create trigger bubatrent_check_verification_update
  before insert on public.bubatrent_booking_verification_updates
  for each row execute function public.bubatrent_check_verification_update();

create or replace function public.bubatrent_admin_review_verification_update(
  p_update_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns public.bubatrent_booking_verification_updates
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_update public.bubatrent_booking_verification_updates;
  v_profile public.bubatrent_booking_profiles;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_uid is null or not coalesce(public.bubatrent_is_admin(), false) then
    raise exception 'Only admins can review document updates.' using errcode = '42501';
  end if;
  if p_approve is null then
    raise exception 'Choose approve or reject.' using errcode = '22023';
  end if;

  select * into v_update from public.bubatrent_booking_verification_updates
   where id = p_update_id for update;
  if not found then
    raise exception 'Update not found.' using errcode = 'P0002';
  end if;
  if v_update.status <> 'pending' then
    raise exception 'This update was already reviewed.' using errcode = '22023';
  end if;
  select * into v_profile from public.bubatrent_booking_profiles where id = v_update.user_id for update;

  if p_approve then
    if v_update.licence_expiry is null or v_update.licence_expiry < v_today then
      raise exception 'The new licence has already expired. Reject it and ask for a valid one.'
        using errcode = '22023';
    end if;

    update public.bubatrent_booking_profiles
       set ic_number = coalesce(nullif(v_update.ic_number, ''), ic_number),
           licence_expiry = v_update.licence_expiry,
           ic_file_path = coalesce(v_update.ic_file_path, ic_file_path),
           licence_file_path = coalesce(v_update.licence_file_path, licence_file_path),
           address_line1 = coalesce(nullif(v_update.address_line1, ''), address_line1),
           address_line2 = case when nullif(v_update.address_line1, '') is not null
                                then nullif(v_update.address_line2, '') else address_line2 end,
           city = coalesce(nullif(v_update.city, ''), city),
           state = coalesce(nullif(v_update.state, ''), state),
           postcode = coalesce(nullif(v_update.postcode, ''), postcode),
           is_verified = true,
           verified_by = v_uid,
           verified_at = now()
     where id = v_update.user_id;

    update public.bubatrent_booking_verification_updates
       set status = 'approved', reviewed_by = v_uid, reviewed_at = now(), rejection_reason = null
     where id = p_update_id
    returning * into v_update;

    insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
    values (
      v_uid, 'APPROVE_VERIFICATION_UPDATE', 'profile', v_update.user_id,
      jsonb_build_object(
        'update_id', v_update.id,
        'licence_expiry_from', v_profile.licence_expiry,
        'licence_expiry_to', v_update.licence_expiry,
        'ic_number_changed', v_update.ic_number is distinct from v_profile.ic_number,
        'new_licence_photo', v_update.licence_file_path is distinct from v_profile.licence_file_path,
        'new_ic_photo', v_update.ic_file_path is distinct from v_profile.ic_file_path)
    );
  else
    if v_reason is null then
      raise exception 'Give the customer a reason for rejecting.' using errcode = '22023';
    end if;
    if char_length(v_reason) > 500 then
      raise exception 'Keep the reason under 500 characters.' using errcode = '22023';
    end if;

    update public.bubatrent_booking_verification_updates
       set status = 'rejected', reviewed_by = v_uid, reviewed_at = now(), rejection_reason = v_reason
     where id = p_update_id
    returning * into v_update;

    insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
    values (
      v_uid, 'REJECT_VERIFICATION_UPDATE', 'profile', v_update.user_id,
      jsonb_build_object('update_id', v_update.id, 'reason', v_reason)
    );
  end if;

  return v_update;
end;
$$;

revoke all on function public.bubatrent_admin_review_verification_update(uuid, boolean, text) from public, anon;
grant execute on function public.bubatrent_admin_review_verification_update(uuid, boolean, text) to authenticated;

commit;
