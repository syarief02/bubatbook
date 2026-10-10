-- =====================================================================
-- Security lockdown + booking integrity (2026-10-11)
--
-- What this fixes:
--   * Profiles (IC numbers, phones, addresses) were readable by anyone,
--     including logged-out visitors.
--   * Customers could update their own role / verification / credit.
--   * Customers could rewrite their own booking status, prices and
--     payment flags.
--   * The customer-documents bucket (IC, licence, receipts) was public.
--   * Availability was only checked in the browser and RLS hid other
--     people's bookings, so double bookings were possible.
--   * Admin writes to payments / credit_transactions failed silently
--     because those policies were missing.
--   * Walk-in customer accounts were created with a fixed password.
--
-- Deploy order: run this migration, then deploy the matching frontend
-- right away. The old frontend writes booking status and prices
-- directly, which this migration intentionally blocks.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------
-- SECURITY DEFINER so policies on bubatrent_booking_profiles can call
-- these without recursing into the profiles policies themselves.
create or replace function public.bubatrent_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bubatrent_booking_profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.bubatrent_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bubatrent_booking_profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

revoke all on function public.bubatrent_is_admin() from public;
revoke all on function public.bubatrent_is_super_admin() from public;
grant execute on function public.bubatrent_is_admin() to anon, authenticated;
grant execute on function public.bubatrent_is_super_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Profiles: visible only to their owner and admins
-- ---------------------------------------------------------------------
drop policy if exists "Anyone can view profiles" on public.bubatrent_booking_profiles;
drop policy if exists "Users view own profile, admins view all" on public.bubatrent_booking_profiles;
create policy "Users view own profile, admins view all"
  on public.bubatrent_booking_profiles for select to authenticated
  using (id = (select auth.uid()) or public.bubatrent_is_admin());

drop policy if exists "Admins can insert profiles" on public.bubatrent_booking_profiles;
create policy "Admins can insert profiles"
  on public.bubatrent_booking_profiles for insert to authenticated
  with check (public.bubatrent_is_admin());

drop policy if exists "Users can update own profile" on public.bubatrent_booking_profiles;
create policy "Users can update own profile"
  on public.bubatrent_booking_profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Admins can update any profile" on public.bubatrent_booking_profiles;
create policy "Admins can update any profile"
  on public.bubatrent_booking_profiles for update to authenticated
  using (public.bubatrent_is_admin())
  with check (public.bubatrent_is_admin());

-- Column protection. Only direct API calls (anon / authenticated) are
-- checked; SECURITY DEFINER functions, the service role and migrations
-- run as other roles and are trusted.
create or replace function public.bubatrent_protect_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.bubatrent_is_admin() then
      new.role := 'customer';
      new.is_verified := false;
      new.verified_by := null;
      new.verified_at := null;
      new.deposit_credit := 0;
      new.created_by_admin := null;
    elsif new.role is distinct from 'customer' and not public.bubatrent_is_super_admin() then
      raise exception 'Only super admins can assign admin roles' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'Profile id cannot be changed' using errcode = '42501';
  end if;

  if new.role is distinct from old.role and not public.bubatrent_is_super_admin() then
    raise exception 'Only super admins can change roles' using errcode = '42501';
  end if;

  if public.bubatrent_is_admin() then
    return new;
  end if;

  if new.is_verified is distinct from old.is_verified
     or new.verified_by is distinct from old.verified_by
     or new.verified_at is distinct from old.verified_at
     or new.deposit_credit is distinct from old.deposit_credit
     or new.created_by_admin is distinct from old.created_by_admin then
    raise exception 'Not allowed to change verification or credit fields' using errcode = '42501';
  end if;

  -- Once verified, identity details change only through an admin-approved
  -- verification update (bubatrent_booking_verification_updates).
  if old.is_verified and (
       new.ic_number is distinct from old.ic_number
    or new.licence_number is distinct from old.licence_number
    or new.licence_expiry is distinct from old.licence_expiry
    or new.ic_file_path is distinct from old.ic_file_path
    or new.licence_file_path is distinct from old.licence_file_path
    or new.gdl_license is distinct from old.gdl_license) then
    raise exception 'Verified identity details can only be changed through a verification update'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists bubatrent_protect_profile on public.bubatrent_booking_profiles;
create trigger bubatrent_protect_profile
  before insert or update on public.bubatrent_booking_profiles
  for each row execute function public.bubatrent_protect_profile();

-- ---------------------------------------------------------------------
-- 3. Bookings: customers create/pay through RPCs; limited direct edits
-- ---------------------------------------------------------------------
drop policy if exists "Authenticated users can create bookings" on public.bubatrent_booking_bookings;
drop policy if exists "Users or admins can create bookings" on public.bubatrent_booking_bookings;
drop policy if exists "Admins can create bookings" on public.bubatrent_booking_bookings;
create policy "Admins can create bookings"
  on public.bubatrent_booking_bookings for insert to authenticated
  with check (public.bubatrent_is_admin());

-- Missing before, so the admin "Delete booking" button reported success
-- while the booking stayed. Audit logs deliberately stay undeletable.
drop policy if exists "Admins can delete bookings" on public.bubatrent_booking_bookings;
create policy "Admins can delete bookings"
  on public.bubatrent_booking_bookings for delete to authenticated
  using (public.bubatrent_is_admin());

-- Customers may edit their contact details, cancel, and upload the
-- full-payment receipt. Everything else goes through admins or RPCs.
create or replace function public.bubatrent_protect_booking()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  customer_editable constant text[] := array[
    'customer_name', 'customer_email', 'customer_phone', 'notes', 'updated_at',
    'status', 'full_payment_status', 'full_payment_receipt_path'
  ];
begin
  if current_user not in ('anon', 'authenticated') or public.bubatrent_is_admin() then
    return new;
  end if;

  if (to_jsonb(new) - customer_editable) is distinct from (to_jsonb(old) - customer_editable) then
    raise exception 'Not allowed to change these booking fields' using errcode = '42501';
  end if;

  if new.status is distinct from old.status and not (
       (new.status = 'CANCELLED' and old.status in ('HOLD', 'DEPOSIT_PAID'))
    or (new.status = 'EXPIRED' and old.status = 'HOLD')) then
    raise exception 'Not allowed to change booking status from % to %', old.status, new.status
      using errcode = '42501';
  end if;

  if (new.full_payment_status is distinct from old.full_payment_status
      or new.full_payment_receipt_path is distinct from old.full_payment_receipt_path)
     and (old.full_payment_status = 'verified' or new.full_payment_status is distinct from 'uploaded') then
    raise exception 'Not allowed to change the full payment status' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists bubatrent_protect_booking on public.bubatrent_booking_bookings;
create trigger bubatrent_protect_booking
  before update on public.bubatrent_booking_bookings
  for each row execute function public.bubatrent_protect_booking();

-- Abandoned checkouts must not block the overlap constraint below.
update public.bubatrent_booking_bookings
   set status = 'EXPIRED', updated_at = now()
 where status = 'HOLD' and hold_expires_at < now();

-- The database, not the browser, now guarantees one active booking per
-- car per day. Inclusive range: same-day turnover counts as an overlap,
-- matching the existing availability check.
alter table public.bubatrent_booking_bookings
  drop constraint if exists bubatrent_bookings_no_overlap;
alter table public.bubatrent_booking_bookings
  add constraint bubatrent_bookings_no_overlap
  exclude using gist (
    car_id with =,
    daterange(pickup_date, return_date, '[]') with &&
  ) where (status in ('HOLD', 'DEPOSIT_PAID', 'CONFIRMED', 'PICKUP'));

create or replace function public.bubatrent_expire_stale_holds()
returns integer
language sql
security definer
set search_path = ''
as $$
  with expired as (
    update public.bubatrent_booking_bookings
       set status = 'EXPIRED', updated_at = now()
     where status = 'HOLD' and hold_expires_at < now()
    returning 1
  )
  select count(*)::integer from expired;
$$;

-- Returns only a yes/no, so it is safe for logged-out visitors.
create or replace function public.bubatrent_check_availability(
  p_car_id uuid,
  p_pickup date,
  p_return date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.bubatrent_booking_bookings b
     where b.car_id = p_car_id
       and b.status in ('HOLD', 'DEPOSIT_PAID', 'CONFIRMED', 'PICKUP')
       and not (b.status = 'HOLD' and b.hold_expires_at < now())
       and b.pickup_date <= p_return
       and b.return_date >= p_pickup
  );
$$;

-- Prices are computed here from the car's rate, never taken from the
-- browser. Mirrors src/utils/pricing.js: deposit = max(RM100, ceil(30%)).
create or replace function public.bubatrent_create_hold_booking(
  p_car_id uuid,
  p_pickup date,
  p_return date
)
returns public.bubatrent_booking_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_profile public.bubatrent_booking_profiles;
  v_car public.bubatrent_booking_cars;
  v_days integer;
  v_total numeric;
  v_booking public.bubatrent_booking_bookings;
begin
  if v_uid is null then
    raise exception 'Please log in to book.' using errcode = '28000';
  end if;

  select * into v_profile from public.bubatrent_booking_profiles where id = v_uid;
  if not found or not coalesce(v_profile.is_verified, false)
     or (v_profile.licence_expiry is not null and v_profile.licence_expiry < v_today) then
    raise exception 'Your account must be verified before booking.' using errcode = '42501';
  end if;

  if p_pickup is null or p_return is null or p_return <= p_pickup then
    raise exception 'Return date must be after the pick-up date.' using errcode = '22023';
  end if;
  if p_pickup < v_today then
    raise exception 'Pick-up date cannot be in the past.' using errcode = '22023';
  end if;
  if p_return > (v_today + interval '6 months')::date then
    raise exception 'You can only book up to 6 months in advance.' using errcode = '22023';
  end if;

  select * into v_car from public.bubatrent_booking_cars where id = p_car_id;
  if not found then
    raise exception 'Car not found.' using errcode = 'P0002';
  end if;
  if v_car.is_available is false then
    raise exception 'This car is not available for booking right now.' using errcode = '22023';
  end if;

  -- Free dates held by abandoned checkouts, and release this customer's
  -- own earlier holds (re-entering checkout must not block itself).
  update public.bubatrent_booking_bookings
     set status = 'EXPIRED', updated_at = now()
   where status = 'HOLD' and hold_expires_at < now();
  update public.bubatrent_booking_bookings
     set status = 'CANCELLED', updated_at = now()
   where status = 'HOLD' and user_id = v_uid;

  v_days := p_return - p_pickup;
  v_total := v_days * v_car.price_per_day;

  begin
    insert into public.bubatrent_booking_bookings (
      car_id, user_id, pickup_date, return_date, total_price, deposit_amount,
      status, hold_expires_at, fleet_group_id
    ) values (
      v_car.id, v_uid, p_pickup, p_return, v_total, greatest(100, ceil(v_total * 0.3)),
      'HOLD', now() + interval '10 minutes', v_car.fleet_group_id
    )
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'Sorry, this car was just booked for those dates. Please choose different dates.'
      using errcode = 'P0001';
  end;

  return v_booking;
end;
$$;

-- One atomic step: mark deposit paid, record the payment, apply credit.
create or replace function public.bubatrent_submit_booking_deposit(
  p_booking_id uuid,
  p_receipt_path text
)
returns public.bubatrent_booking_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_receipt text := nullif(trim(coalesce(p_receipt_path, '')), '');
  v_booking public.bubatrent_booking_bookings;
  v_credit numeric;
  v_applied numeric;
  v_due numeric;
begin
  if v_uid is null then
    raise exception 'Please log in again.' using errcode = '28000';
  end if;

  select * into v_booking from public.bubatrent_booking_bookings
   where id = p_booking_id and user_id = v_uid
   for update;
  if not found then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;
  if v_booking.status <> 'HOLD' then
    raise exception 'This booking is no longer waiting for a deposit.' using errcode = '22023';
  end if;
  if v_booking.hold_expires_at is not null and v_booking.hold_expires_at < now() then
    raise exception 'Your hold has expired. Please start over.' using errcode = '22023';
  end if;
  if v_receipt is not null and v_receipt not like 'receipts/' || p_booking_id::text || '/%' then
    raise exception 'Invalid receipt path.' using errcode = '22023';
  end if;

  select coalesce(deposit_credit, 0) into v_credit
    from public.bubatrent_booking_profiles where id = v_uid
    for update;
  v_applied := least(v_credit, v_booking.deposit_amount);
  v_due := v_booking.deposit_amount - v_applied;

  if v_due > 0 and v_receipt is null then
    raise exception 'Please upload your payment receipt.' using errcode = '22023';
  end if;

  update public.bubatrent_booking_bookings
     set status = 'DEPOSIT_PAID',
         deposit_status = case when v_due > 0 then 'uploaded' else 'verified' end,
         deposit_receipt_path = v_receipt,
         credit_applied = v_applied,
         hold_expires_at = null,
         full_payment_amount = v_booking.total_price,
         updated_at = now()
   where id = p_booking_id
  returning * into v_booking;

  insert into public.bubatrent_booking_payments (
    booking_id, amount, payment_method, status, simulated, payment_type,
    receipt_path, reference_number, fleet_group_id
  ) values (
    p_booking_id, v_booking.deposit_amount, 'bank_transfer',
    case when v_due > 0 then 'pending' else 'completed' end,
    false, 'deposit', v_receipt,
    'DEP-' || upper(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint)),
    v_booking.fleet_group_id
  );

  if v_applied > 0 then
    update public.bubatrent_booking_profiles
       set deposit_credit = v_credit - v_applied
     where id = v_uid;
    insert into public.bubatrent_booking_credit_transactions (
      user_id, booking_id, amount, type, description, fleet_group_id
    ) values (
      v_uid, p_booking_id, -v_applied, 'applied', 'Credit applied to booking deposit',
      v_booking.fleet_group_id
    );
  end if;

  return v_booking;
end;
$$;

revoke all on function public.bubatrent_expire_stale_holds() from public;
revoke all on function public.bubatrent_check_availability(uuid, date, date) from public;
revoke all on function public.bubatrent_create_hold_booking(uuid, date, date) from public;
revoke all on function public.bubatrent_submit_booking_deposit(uuid, text) from public;
revoke execute on function public.bubatrent_expire_stale_holds() from anon;
revoke execute on function public.bubatrent_create_hold_booking(uuid, date, date) from anon;
revoke execute on function public.bubatrent_submit_booking_deposit(uuid, text) from anon;
grant execute on function public.bubatrent_expire_stale_holds() to authenticated;
grant execute on function public.bubatrent_check_availability(uuid, date, date) to anon, authenticated;
grant execute on function public.bubatrent_create_hold_booking(uuid, date, date) to authenticated;
grant execute on function public.bubatrent_submit_booking_deposit(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Payments, credit ledger, audit and upload logs
-- ---------------------------------------------------------------------
-- Customers record deposits through bubatrent_submit_booking_deposit.
drop policy if exists "Authenticated users can create payments" on public.bubatrent_booking_payments;
drop policy if exists "Admins can create payments" on public.bubatrent_booking_payments;
create policy "Admins can create payments"
  on public.bubatrent_booking_payments for insert to authenticated
  with check (public.bubatrent_is_admin());

-- These were missing, so admin "mark payment completed" silently did nothing.
drop policy if exists "Admins can update payments" on public.bubatrent_booking_payments;
create policy "Admins can update payments"
  on public.bubatrent_booking_payments for update to authenticated
  using (public.bubatrent_is_admin())
  with check (public.bubatrent_is_admin());

drop policy if exists "Admins can delete payments" on public.bubatrent_booking_payments;
create policy "Admins can delete payments"
  on public.bubatrent_booking_payments for delete to authenticated
  using (public.bubatrent_is_admin());

-- Missing too: the credit ledger had never recorded a single row.
drop policy if exists "System can insert credit transactions" on public.bubatrent_booking_credit_transactions;
drop policy if exists "Admins can create credit transactions" on public.bubatrent_booking_credit_transactions;
create policy "Admins can create credit transactions"
  on public.bubatrent_booking_credit_transactions for insert to authenticated
  with check (public.bubatrent_is_admin());

drop policy if exists "Admins can delete credit transactions" on public.bubatrent_booking_credit_transactions;
create policy "Admins can delete credit transactions"
  on public.bubatrent_booking_credit_transactions for delete to authenticated
  using (public.bubatrent_is_admin());

drop policy if exists "Anyone can insert audit logs" on public.bubatrent_booking_audit_logs;
drop policy if exists "Admins can create audit logs" on public.bubatrent_booking_audit_logs;
create policy "Admins can create audit logs"
  on public.bubatrent_booking_audit_logs for insert to authenticated
  with check (public.bubatrent_is_admin());

drop policy if exists "Anyone can insert upload logs" on public.bubatrent_booking_upload_logs;
drop policy if exists "Users can insert own upload logs" on public.bubatrent_booking_upload_logs;
create policy "Users can insert own upload logs"
  on public.bubatrent_booking_upload_logs for insert to authenticated
  with check (user_id = (select auth.uid()));

-- This policy queried its own table, so every read of memberships by a
-- non-super admin failed with "infinite recursion detected in policy".
create or replace function public.bubatrent_is_fleet_admin(p_fleet_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bubatrent_booking_fleet_memberships
    where fleet_group_id = p_fleet_group_id
      and user_id = auth.uid()
      and role = 'fleet_admin'
  );
$$;
revoke all on function public.bubatrent_is_fleet_admin(uuid) from public;
grant execute on function public.bubatrent_is_fleet_admin(uuid) to authenticated;

drop policy if exists "Fleet admins can manage memberships" on public.bubatrent_booking_fleet_memberships;
create policy "Fleet admins can manage memberships"
  on public.bubatrent_booking_fleet_memberships for all to authenticated
  using (public.bubatrent_is_fleet_admin(fleet_group_id))
  with check (public.bubatrent_is_fleet_admin(fleet_group_id));

-- Registering a fleet adds its creator as fleet admin; no existing fleet
-- admin can approve that first membership, so it always failed before.
drop policy if exists "Fleet creators can join their new fleet" on public.bubatrent_booking_fleet_memberships;
create policy "Fleet creators can join their new fleet"
  on public.bubatrent_booking_fleet_memberships for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'fleet_admin'
    and exists (
      select 1 from public.bubatrent_booking_fleet_groups g
      where g.id = fleet_group_id and g.created_by = (select auth.uid())
    )
  );

drop policy if exists "Fleet groups insertable by authenticated users" on public.bubatrent_booking_fleet_groups;
drop policy if exists "Admins can create fleet groups" on public.bubatrent_booking_fleet_groups;
create policy "Admins can create fleet groups"
  on public.bubatrent_booking_fleet_groups for insert to authenticated
  with check (public.bubatrent_is_admin());

-- Fleet admins may edit their group's name and contacts, but only super
-- admins approve, suspend or promote a group. Before this, a fleet admin
-- could verify their own group or flag it as the Super Group.
create or replace function public.bubatrent_protect_fleet_group()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.bubatrent_is_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'PENDING_VERIFICATION';
    new.is_super_group := false;
    new.created_by := auth.uid();
    new.verified_at := null;
    new.verified_by := null;
    new.rejection_reason := null;
    new.suspended_at := null;
    new.suspended_by := null;
    new.suspension_reason := null;
    new.suspension_notes := null;
    return new;
  end if;

  if new.status is distinct from old.status
     or new.is_super_group is distinct from old.is_super_group
     or new.created_by is distinct from old.created_by
     or new.verified_at is distinct from old.verified_at
     or new.verified_by is distinct from old.verified_by
     or new.rejection_reason is distinct from old.rejection_reason
     or new.suspended_at is distinct from old.suspended_at
     or new.suspended_by is distinct from old.suspended_by
     or new.suspension_reason is distinct from old.suspension_reason
     or new.suspension_notes is distinct from old.suspension_notes then
    raise exception 'Only super admins can approve, suspend or promote a fleet group'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists bubatrent_protect_fleet_group on public.bubatrent_booking_fleet_groups;
create trigger bubatrent_protect_fleet_group
  before insert or update on public.bubatrent_booking_fleet_groups
  for each row execute function public.bubatrent_protect_fleet_group();

-- ---------------------------------------------------------------------
-- 5. Walk-in customers: random password instead of a shared one
-- ---------------------------------------------------------------------
create or replace function public.admin_create_walk_in_customer(
  p_id uuid,
  p_display_name text,
  p_ic_number text,
  p_phone text,
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_state text,
  p_postcode text,
  p_licence_expiry date,
  p_ic_file_path text,
  p_licence_file_path text,
  p_admin_id uuid,
  p_email text default null,
  p_gdl_license text default 'NONE'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_admin uuid := auth.uid();
begin
  if not public.bubatrent_is_admin() then
    raise exception 'Not authorized: admin role required' using errcode = '42501';
  end if;
  if p_email is not null and trim(p_email) <> '' then
    v_email := trim(p_email);
  else
    v_email := 'walkin_' || p_id || '@bubatrent.local';
  end if;

  -- The customer sets their own password later via "Forgot password".
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, created_at, updated_at
  ) values (
    p_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(encode(extensions.gen_random_bytes(32), 'base64'), extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('name', p_display_name, 'is_walk_in', true),
    now(),
    now()
  )
  on conflict (id) do update set
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  insert into public.bubatrent_booking_profiles (
    id, display_name, ic_number, phone, email,
    address_line1, address_line2, address_city, address_state, address_postcode,
    city, state, postcode, licence_expiry, gdl_license,
    ic_file_path, licence_file_path, created_by_admin, verified_by, verified_at,
    is_verified, role
  ) values (
    p_id, p_display_name, p_ic_number, p_phone, v_email,
    p_address_line1, p_address_line2, p_city, p_state, p_postcode,
    p_city, p_state, p_postcode, p_licence_expiry, coalesce(p_gdl_license, 'NONE'),
    p_ic_file_path, p_licence_file_path, v_admin, v_admin, now(),
    true, 'customer'
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    ic_number = excluded.ic_number,
    phone = excluded.phone,
    email = excluded.email,
    address_line1 = excluded.address_line1,
    address_line2 = excluded.address_line2,
    address_city = excluded.address_city,
    address_state = excluded.address_state,
    address_postcode = excluded.address_postcode,
    city = excluded.city,
    state = excluded.state,
    postcode = excluded.postcode,
    licence_expiry = excluded.licence_expiry,
    gdl_license = excluded.gdl_license,
    ic_file_path = excluded.ic_file_path,
    licence_file_path = excluded.licence_file_path,
    created_by_admin = excluded.created_by_admin,
    verified_by = excluded.verified_by,
    verified_at = excluded.verified_at,
    is_verified = true,
    role = 'customer';
end;
$$;

revoke all on function public.admin_create_walk_in_customer(
  uuid, text, text, text, text, text, text, text, text, date, text, text, uuid, text, text
) from public, anon;
grant execute on function public.admin_create_walk_in_customer(
  uuid, text, text, text, text, text, text, text, text, date, text, text, uuid, text, text
) to authenticated;

-- Replace the shared password on walk-in accounts that still have it.
update auth.users
   set encrypted_password = extensions.crypt(
         encode(extensions.gen_random_bytes(32), 'base64'), extensions.gen_salt('bf')),
       updated_at = now()
 where encrypted_password is not null
   and encrypted_password = extensions.crypt('dummy_password', encrypted_password);

-- ---------------------------------------------------------------------
-- 6. Storage: private bucket, files visible to their uploader and admins
-- ---------------------------------------------------------------------
update storage.buckets
   set public = false,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
 where id = 'customer-documents';

drop policy if exists "Anyone can view public documents" on storage.objects;
drop policy if exists "Public read access" on storage.objects;
drop policy if exists "Users can read own docs" on storage.objects;
drop policy if exists "Admins can read documents" on storage.objects;
drop policy if exists "Owners and admins can read customer documents" on storage.objects;
create policy "Owners and admins can read customer documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'customer-documents'
    and (owner_id = (select auth.uid())::text or public.bubatrent_is_admin())
  );

drop policy if exists "Users can update documents" on storage.objects;
drop policy if exists "Owners and admins can update customer documents" on storage.objects;
create policy "Owners and admins can update customer documents"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'customer-documents'
    and (owner_id = (select auth.uid())::text or public.bubatrent_is_admin())
  )
  with check (bucket_id = 'customer-documents');

drop policy if exists "Admins can delete customer documents" on storage.objects;
create policy "Admins can delete customer documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'customer-documents' and public.bubatrent_is_admin());

commit;
