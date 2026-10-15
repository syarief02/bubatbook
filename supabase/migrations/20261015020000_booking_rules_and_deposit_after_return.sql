-- =====================================================================
-- Booking rules, deposit credit after return, booking history, and
-- receipts for customers (2026-10-15)
--
-- Found in the end-to-end test:
--   * A verified deposit became customer credit straight away, before the
--     car was picked up. The customer could spend it on another booking's
--     deposit while the first rental was still running, although the rental
--     agreement says the deposit is refunded after the rental.
--   * Admins could confirm a booking before its deposit was verified, and
--     the pickup check counted the security deposit as rent (a 1-day RM100
--     rental with the minimum RM100 deposit passed with no rent paid). Both
--     checks lived only in the browser.
--   * Verifying payments, confirming, pickup and return left no audit trail.
--   * A booking's "updated" time only changed when the browser sent one.
--   * Customers couldn't open receipts an admin uploaded for their booking
--     (walk-in bookings, or a full payment receipt uploaded on their behalf).
--
-- Now:
--   * Verifying a deposit only marks it verified. The deposit goes to the
--     customer's credit when the booking is returned, or cancelled after
--     the deposit was verified; deposit_credited_at records when, so it
--     happens once. Admins deduct charges with Deduct Credit afterwards.
--     Verifying a counter booking's cash deposit (no receipt, no payment
--     row) records the payment.
--   * Cancelling before the deposit is verified gives back any credit the
--     customer applied to it, as the 48-hour release already does.
--   * The database refuses CONFIRMED until the deposit is verified, PICKUP
--     until the agreement is signed and the full payment is verified, and
--     RETURNED unless the car was picked up. Only requests from the website
--     are checked, not the service role or scheduled jobs.
--   * Every status and payment change on a booking is written to the audit
--     log by the database, with who made it (admin, customer or system).
--   * updated_at is set on every booking change.
--   * A signed-in customer can open any receipt attached to their own
--     bookings, whoever uploaded it.
--
-- Bookings already returned or cancelled, and bookings whose deposit was
-- credited under the old rule, are marked settled so nothing is credited
-- twice.
--
-- Deploy order: run before the frontend ships. The current frontend keeps
-- working; the new one rewords "Customer credit updated" and shows the
-- deposit's state.
-- =====================================================================

begin;

alter table public.bubatrent_booking_bookings
  add column if not exists deposit_credited_at timestamptz;

comment on column public.bubatrent_booking_bookings.deposit_credited_at is
  'When the deposit went back to the customer''s credit (on return or cancellation). Null while it is held.';

-- Settled under the old rule: bookings that are over, and deposits that
-- were credited when they were verified.
update public.bubatrent_booking_bookings b
   set deposit_credited_at = coalesce(
         (select min(t.created_at) from public.bubatrent_booking_credit_transactions t
           where t.booking_id = b.id and t.type = 'deposit_return' and t.amount > 0),
         b.updated_at,
         now())
 where b.deposit_credited_at is null
   and (b.status in ('RETURNED', 'CANCELLED')
        or exists (
          select 1 from public.bubatrent_booking_credit_transactions t
           where t.booking_id = b.id and t.type = 'deposit_return' and t.amount > 0
             and t.description = 'Deposit verified — credit added'));

-- ---------------------------------------------------------------------
-- 1. Before each booking change: rules, updated_at, deposit settlement
-- ---------------------------------------------------------------------
-- Fires after bubatrent_protect_booking (triggers run in name order), so
-- the customer-field check sees only what the customer sent.
create or replace function public.bubatrent_track_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- This function runs as its owner, so current_user can't tell a website
  -- request apart; the role setting still holds the request's role.
  v_from_site boolean := coalesce(current_setting('role', true), '') in ('anon', 'authenticated');
  v_admin uuid := case when public.bubatrent_is_admin() then auth.uid() end;
  v_applied numeric;
  v_amount numeric;
begin
  new.updated_at := now();

  if v_from_site and new.status is distinct from old.status then
    if new.status = 'CONFIRMED' and coalesce(new.deposit_status, '') <> 'verified' then
      raise exception 'Verify the deposit before confirming this booking.' using errcode = '22023';
    end if;
    if new.status = 'PICKUP' then
      if not exists (
        select 1 from public.bubatrent_booking_rental_agreements a where a.booking_id = new.id
      ) then
        raise exception 'Cannot mark as picked up: the rental agreement has not been signed yet.'
          using errcode = '22023';
      end if;
      if coalesce(new.full_payment_status, '') <> 'verified' then
        raise exception 'Cannot mark as picked up: verify the full rental payment first.'
          using errcode = '22023';
      end if;
    end if;
    if new.status = 'RETURNED' and old.status <> 'PICKUP' then
      raise exception 'Only a booking that was picked up can be marked returned.'
        using errcode = '22023';
    end if;
  end if;

  -- The deposit goes back to the customer as credit once the booking is
  -- over: returned, or cancelled after the deposit was verified.
  if new.user_id is not null
     and new.deposit_credited_at is null
     and new.status in ('RETURNED', 'CANCELLED')
     and new.deposit_status = 'verified'
     and (new.status is distinct from old.status
          or old.deposit_status is distinct from 'verified') then
    -- Credit the customer applied to this deposit and already got back (the
    -- 48-hour release sets credit_applied to 0) isn't paid out twice.
    select coalesce(-sum(t.amount), 0) into v_applied
      from public.bubatrent_booking_credit_transactions t
     where t.booking_id = new.id and t.type = 'applied';
    v_amount := greatest(
      coalesce(new.deposit_amount, 0) - greatest(v_applied - coalesce(new.credit_applied, 0), 0), 0);

    if v_amount > 0 then
      update public.bubatrent_booking_profiles
         set deposit_credit = coalesce(deposit_credit, 0) + v_amount
       where id = new.user_id;
      insert into public.bubatrent_booking_credit_transactions (
        user_id, booking_id, amount, type, description, admin_id, fleet_group_id
      ) values (
        new.user_id, new.id, v_amount, 'deposit_return',
        case when new.status = 'RETURNED' then 'Deposit returned after the rental'
             else 'Deposit returned: booking cancelled' end,
        v_admin, new.fleet_group_id
      );
    end if;
    new.deposit_credited_at := now();

  -- Cancelled before the deposit was verified: give back the credit the
  -- customer applied to it.
  elsif new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED'
        and new.user_id is not null
        and new.deposit_credited_at is null
        and coalesce(new.deposit_status, '') <> 'verified'
        and coalesce(new.credit_applied, 0) > 0 then
    update public.bubatrent_booking_profiles
       set deposit_credit = coalesce(deposit_credit, 0) + new.credit_applied
     where id = new.user_id;
    insert into public.bubatrent_booking_credit_transactions (
      user_id, booking_id, amount, type, description, admin_id, fleet_group_id
    ) values (
      new.user_id, new.id, new.credit_applied, 'deposit_return',
      'Booking cancelled: credit returned', v_admin, new.fleet_group_id
    );
    new.credit_applied := 0;
  end if;

  return new;
end;
$$;

revoke all on function public.bubatrent_track_booking() from public, anon, authenticated;

drop trigger if exists bubatrent_track_booking on public.bubatrent_booking_bookings;
create trigger bubatrent_track_booking
  before update on public.bubatrent_booking_bookings
  for each row execute function public.bubatrent_track_booking();

-- ---------------------------------------------------------------------
-- 2. After each booking change: audit log
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_audit_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_by text := case when auth.uid() is null then 'system'
                    when public.bubatrent_is_admin() then 'admin'
                    else 'customer' end;
  v_submit boolean := old.status = 'HOLD' and new.status = 'DEPOSIT_PAID';
  v_log jsonb := '[]'::jsonb;
  v_credit numeric;
begin
  -- Expiry is routine (holds) or logged by the 48-hour release itself, and
  -- a HOLD cancelled at checkout is an abandoned cart.
  if new.status is distinct from old.status
     and new.status <> 'EXPIRED'
     and not (old.status = 'HOLD' and new.status = 'CANCELLED') then
    v_log := v_log || jsonb_build_object(
      'action', case
        when old.status = 'EXPIRED' then 'REACTIVATE_EXPIRED'
        when v_submit then 'SUBMIT_DEPOSIT'
        when new.status = 'CONFIRMED' then 'CONFIRM_BOOKING'
        when new.status = 'PICKUP' then 'MARK_PICKED_UP'
        when new.status = 'RETURNED' then 'MARK_RETURNED'
        when new.status = 'CANCELLED' then 'CANCEL_BOOKING'
        else 'CHANGE_STATUS' end,
      'details', jsonb_build_object('from', old.status, 'to', new.status)
        || case when old.status = 'EXPIRED'
             then jsonb_build_object('reason', new.reactivation_reason) else '{}'::jsonb end
        || case when v_submit
             then jsonb_build_object('amount', new.deposit_amount, 'credit_applied', new.credit_applied)
             else '{}'::jsonb end);
  end if;

  if new.deposit_status is distinct from old.deposit_status and not v_submit then
    v_log := v_log || jsonb_build_object(
      'action', case new.deposit_status
        when 'verified' then 'VERIFY_DEPOSIT'
        when 'rejected' then 'REJECT_DEPOSIT'
        when 'uploaded' then 'UPLOAD_DEPOSIT_RECEIPT'
        else 'CHANGE_DEPOSIT_STATUS' end,
      'details', jsonb_build_object(
        'from', old.deposit_status, 'to', new.deposit_status, 'amount', new.deposit_amount));
  end if;

  if new.full_payment_status is distinct from old.full_payment_status then
    v_log := v_log || jsonb_build_object(
      'action', case new.full_payment_status
        when 'verified' then 'VERIFY_FULL_PAYMENT'
        when 'uploaded' then 'UPLOAD_FULL_PAYMENT'
        else 'CHANGE_FULL_PAYMENT_STATUS' end,
      'details', jsonb_build_object(
        'from', old.full_payment_status, 'to', new.full_payment_status,
        'amount', coalesce(new.full_payment_amount, new.total_price)));
  end if;

  if new.pickup_date is distinct from old.pickup_date
     or new.return_date is distinct from old.return_date then
    v_log := v_log || jsonb_build_object(
      'action', 'CHANGE_DATES',
      'details', jsonb_build_object(
        'from', old.pickup_date || ' → ' || old.return_date,
        'to', new.pickup_date || ' → ' || new.return_date));
  end if;

  if new.total_price is distinct from old.total_price
     or new.deposit_amount is distinct from old.deposit_amount then
    v_log := v_log || jsonb_build_object(
      'action', 'CHANGE_PRICE',
      'details', jsonb_build_object(
        'total_from', old.total_price, 'total_to', new.total_price,
        'deposit_from', old.deposit_amount, 'deposit_to', new.deposit_amount));
  end if;

  if new.deposit_credited_at is not null and old.deposit_credited_at is null then
    -- The ledger row bubatrent_track_booking wrote in this transaction
    select coalesce(sum(t.amount), 0) into v_credit
      from public.bubatrent_booking_credit_transactions t
     where t.booking_id = new.id and t.type = 'deposit_return' and t.created_at = now();
    v_log := v_log || jsonb_build_object(
      'action', 'DEPOSIT_TO_CREDIT', 'details', jsonb_build_object('amount', v_credit));
  end if;

  if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED'
     and coalesce(old.credit_applied, 0) > 0 and coalesce(new.credit_applied, 0) = 0 then
    v_log := v_log || jsonb_build_object(
      'action', 'RETURN_APPLIED_CREDIT', 'details', jsonb_build_object('amount', old.credit_applied));
  end if;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  select auth.uid(), e->>'action', 'booking', new.id, (e->'details') || jsonb_build_object('by', v_by)
    from jsonb_array_elements(v_log) e;

  return null;
end;
$$;

revoke all on function public.bubatrent_audit_booking() from public, anon, authenticated;

drop trigger if exists bubatrent_audit_booking on public.bubatrent_booking_bookings;
create trigger bubatrent_audit_booking
  after update on public.bubatrent_booking_bookings
  for each row execute function public.bubatrent_audit_booking();

-- ---------------------------------------------------------------------
-- 3. Verifying a deposit no longer credits it (see 1)
-- ---------------------------------------------------------------------
-- As in 20261015000000, minus the credit.
create or replace function public.bubatrent_admin_verify_deposit(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings;
begin
  if not public.bubatrent_is_admin() then
    raise exception 'Not authorized: admin role required' using errcode = '42501';
  end if;

  select * into v_booking from public.bubatrent_booking_bookings
   where id = p_booking_id
   for update;
  if not found or not public.bubatrent_can_access_fleet(v_booking.fleet_group_id) then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;
  if v_booking.deposit_status = 'verified' then
    return jsonb_build_object('status', 'already_verified');
  end if;

  -- Credited when the booking is returned (or now, if it is already over),
  -- by bubatrent_track_booking.
  update public.bubatrent_booking_bookings
     set deposit_status = 'verified'
   where id = p_booking_id;

  update public.bubatrent_booking_payments
     set status = 'completed'
   where booking_id = p_booking_id and payment_type = 'deposit';

  -- Counter bookings made without a receipt have no payment row yet: the
  -- admin is recording a cash deposit.
  if not found and coalesce(v_booking.deposit_amount, 0) > 0 then
    insert into public.bubatrent_booking_payments (
      booking_id, amount, payment_method, status, simulated, payment_type,
      receipt_path, reference_number, fleet_group_id
    ) values (
      p_booking_id, v_booking.deposit_amount,
      case when v_booking.deposit_receipt_path is null then 'cash' else 'bank_transfer' end,
      'completed', false, 'deposit', v_booking.deposit_receipt_path,
      'DEP-' || upper(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint)),
      v_booking.fleet_group_id
    );
  end if;

  return jsonb_build_object('status', 'verified');
end;
$$;

revoke all on function public.bubatrent_admin_verify_deposit(uuid) from public, anon;
grant execute on function public.bubatrent_admin_verify_deposit(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Customers can open receipts attached to their own bookings
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_is_own_booking_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bubatrent_booking_bookings b
     where b.user_id = auth.uid()
       and p_name in (b.deposit_receipt_path, b.full_payment_receipt_path)
  );
$$;

revoke all on function public.bubatrent_is_own_booking_file(text) from public, anon;
grant execute on function public.bubatrent_is_own_booking_file(text) to authenticated;

-- Customers can only point a booking at files under receipts/<their booking>/
-- (bubatrent_protect_booking, bubatrent_submit_booking_deposit); other
-- paths are set by admins.
drop policy if exists "Owners and admins can read customer documents" on storage.objects;
create policy "Owners and admins can read customer documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'customer-documents'
    and (
      owner_id = (select auth.uid())::text
      or public.bubatrent_is_admin()
      or public.bubatrent_is_own_booking_file(name)
    )
  );

commit;
