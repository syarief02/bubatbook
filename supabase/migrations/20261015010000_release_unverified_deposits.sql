-- =====================================================================
-- Release bookings whose deposit is not verified within 48 hours (2026-10-15)
--
-- A booking in DEPOSIT_PAID holds its car until an admin acts. A customer
-- could upload any image as a receipt and keep a car blocked indefinitely,
-- and rejected receipts kept blocking too.
--
-- Now:
--   * A deposit submitted online gets a 48-hour verification deadline
--     (deposit_review_due_at). Deposits fully covered by credit are verified
--     on the spot and get none; bookings admins create at the counter get none.
--   * Past the deadline, an unverified booking becomes EXPIRED, which frees
--     the car. Credit the customer applied is returned to their balance, and
--     the audit log records the release.
--   * Releasing clears the deadline, so a booking an admin reactivates is
--     not released again.
--   * Releases happen whenever a hold is created and whenever the existing
--     stale-hold cleanup runs (admin pages call it), and the availability
--     check already treats overdue bookings as free. If pg_cron is
--     available, a job also runs the release every 10 minutes so statuses
--     and credit refunds don't wait for site activity.
--   * Deposits already waiting when this ships get 48 hours from now.
--
-- Deploy order: safe to run before the frontend ships (the frontend only
-- adds wording that shows the deadline).
-- =====================================================================

begin;

alter table public.bubatrent_booking_bookings
  add column if not exists deposit_review_due_at timestamptz;

-- Deposits already waiting: 48 hours from now, except counter bookings.
update public.bubatrent_booking_bookings b
   set deposit_review_due_at = now() + interval '48 hours'
 where b.status = 'DEPOSIT_PAID'
   and coalesce(b.deposit_status, '') <> 'verified'
   and b.deposit_review_due_at is null
   and not exists (
     select 1 from public.bubatrent_booking_audit_logs a
      where a.resource_id = b.id and a.action = 'ADMIN_CREATE_BOOKING')
   and not exists (
     select 1 from public.bubatrent_booking_payments p
      where p.booking_id = b.id and p.reference_number like 'ADMIN-%');

-- ---------------------------------------------------------------------
-- 1. The release itself
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_release_unverified_deposits()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_count integer := 0;
begin
  -- The row lock taken by this update makes a concurrent "Verify deposit"
  -- either finish first (the booking is then skipped) or wait and see EXPIRED.
  for r in
    update public.bubatrent_booking_bookings
       set status = 'EXPIRED', deposit_review_due_at = null, updated_at = now()
     where status = 'DEPOSIT_PAID'
       and coalesce(deposit_status, '') <> 'verified'
       and deposit_review_due_at < now()
    returning id, user_id, credit_applied, deposit_status, fleet_group_id
  loop
    v_count := v_count + 1;

    if coalesce(r.credit_applied, 0) > 0 and r.user_id is not null then
      update public.bubatrent_booking_profiles
         set deposit_credit = coalesce(deposit_credit, 0) + r.credit_applied
       where id = r.user_id;
      update public.bubatrent_booking_bookings set credit_applied = 0 where id = r.id;
      insert into public.bubatrent_booking_credit_transactions (
        user_id, booking_id, amount, type, description, fleet_group_id
      ) values (
        r.user_id, r.id, r.credit_applied, 'deposit_return',
        'Booking released (deposit not verified within 48 hours): credit returned',
        r.fleet_group_id
      );
    end if;

    insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
    values (
      null, 'AUTO_RELEASE_UNVERIFIED_DEPOSIT', 'booking', r.id,
      jsonb_build_object(
        'deposit_status', r.deposit_status,
        'credit_returned', coalesce(r.credit_applied, 0)
      )
    );
  end loop;

  return v_count;
end;
$$;

revoke all on function public.bubatrent_release_unverified_deposits() from public, anon;
grant execute on function public.bubatrent_release_unverified_deposits() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Existing functions, each as in 20261011120000 plus the release
-- ---------------------------------------------------------------------
-- Stale-hold cleanup (called by admin pages) also releases overdue deposits.
create or replace function public.bubatrent_expire_stale_holds()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_holds integer;
begin
  with expired as (
    update public.bubatrent_booking_bookings
       set status = 'EXPIRED', updated_at = now()
     where status = 'HOLD' and hold_expires_at < now()
    returning 1
  )
  select count(*)::integer into v_holds from expired;

  return v_holds + public.bubatrent_release_unverified_deposits();
end;
$$;

-- Overdue unverified deposits no longer count as taking the car.
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
       and not (b.status = 'DEPOSIT_PAID'
                and coalesce(b.deposit_status, '') <> 'verified'
                and b.deposit_review_due_at < now())
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

  -- Free dates held by abandoned checkouts and by deposits not verified in
  -- time, and release this customer's own earlier holds (re-entering
  -- checkout must not block itself).
  update public.bubatrent_booking_bookings
     set status = 'EXPIRED', updated_at = now()
   where status = 'HOLD' and hold_expires_at < now();
  perform public.bubatrent_release_unverified_deposits();
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

-- One atomic step: mark deposit paid, record the payment, apply credit,
-- and start the 48-hour verification deadline when a receipt needs checking.
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
         deposit_review_due_at = case when v_due > 0 then now() + interval '48 hours' end,
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

-- ---------------------------------------------------------------------
-- 3. Scheduled release (only where pg_cron is available)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron is not available: overdue deposits are released on site activity only';
    return;
  end if;
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.unschedule(jobid) from cron.job where jobname = 'rent2go-release-unverified-deposits';
  perform cron.schedule(
    'rent2go-release-unverified-deposits',
    '*/10 * * * *',
    'select public.bubatrent_release_unverified_deposits()'
  );
  raise notice 'pg_cron job rent2go-release-unverified-deposits scheduled every 10 minutes';
exception when others then
  raise notice 'pg_cron job not set up (%): overdue deposits are released on site activity only', sqlerrm;
end $$;

commit;
