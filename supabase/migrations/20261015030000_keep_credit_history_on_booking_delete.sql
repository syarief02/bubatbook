-- =====================================================================
-- Deleting a booking keeps the customer's credit history (2026-10-15)
--
-- The admin "Delete booking" button removed the booking's credit ledger
-- rows but not the balance they explain, so a customer's credit and their
-- credit history stopped matching. Credit the customer had put into the
-- booking (applied to the deposit, or a verified deposit not yet returned)
-- was simply lost.
--
-- Now:
--   * Credit ledger rows can't be deleted from the website any more (the
--     service role still can); the history stays when a booking is deleted.
--   * Before a booking is deleted, anything it still holds for the customer
--     goes back to their credit, as when it is cancelled: a verified deposit
--     not yet returned, or credit applied to a deposit not yet verified.
--   * The deletion is written to the audit log with the booking's details.
--   * The deposit-return arithmetic now lives in one function used by both
--     the cancel/return trigger and the delete trigger (same results as
--     20261015020000).
--
-- Deploy order: run before the frontend ships. The old frontend keeps
-- working: its "delete ledger rows" step just removes nothing now.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. What a booking still holds for its customer, handed back as credit
-- ---------------------------------------------------------------------
-- A verified deposit not yet returned: the deposit, less credit applied to
-- it that already came back (the 48-hour release or a cancellation sets
-- credit_applied to 0). An unverified deposit: only the credit applied.
-- Returns the amount credited. Callers record that it was settled.
create or replace function public.bubatrent_give_back_booking_credit(
  p_booking public.bubatrent_booking_bookings,
  p_description text
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_applied numeric;
  v_amount numeric;
begin
  if p_booking.user_id is null or p_booking.deposit_credited_at is not null then
    return 0;
  end if;

  if p_booking.deposit_status = 'verified' then
    select coalesce(-sum(t.amount), 0) into v_applied
      from public.bubatrent_booking_credit_transactions t
     where t.booking_id = p_booking.id and t.type = 'applied';
    v_amount := greatest(
      coalesce(p_booking.deposit_amount, 0)
        - greatest(v_applied - coalesce(p_booking.credit_applied, 0), 0), 0);
  else
    v_amount := greatest(coalesce(p_booking.credit_applied, 0), 0);
  end if;

  if v_amount > 0 then
    update public.bubatrent_booking_profiles
       set deposit_credit = coalesce(deposit_credit, 0) + v_amount
     where id = p_booking.user_id;
    insert into public.bubatrent_booking_credit_transactions (
      user_id, booking_id, amount, type, description, admin_id, fleet_group_id
    ) values (
      p_booking.user_id, p_booking.id, v_amount, 'deposit_return', p_description,
      case when public.bubatrent_is_admin() then auth.uid() end, p_booking.fleet_group_id
    );
  end if;
  return v_amount;
end;
$$;

revoke all on function public.bubatrent_give_back_booking_credit(public.bubatrent_booking_bookings, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Return/cancel trigger, as in 20261015020000 but using the function
-- ---------------------------------------------------------------------
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
    perform public.bubatrent_give_back_booking_credit(
      new,
      case when new.status = 'RETURNED' then 'Deposit returned after the rental'
           else 'Deposit returned: booking cancelled' end);
    new.deposit_credited_at := now();

  -- Cancelled before the deposit was verified: give back the credit the
  -- customer applied to it.
  elsif new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED'
        and new.user_id is not null
        and new.deposit_credited_at is null
        and coalesce(new.deposit_status, '') <> 'verified'
        and coalesce(new.credit_applied, 0) > 0 then
    perform public.bubatrent_give_back_booking_credit(new, 'Booking cancelled: credit returned');
    new.credit_applied := 0;
  end if;

  return new;
end;
$$;

revoke all on function public.bubatrent_track_booking() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Before a booking is deleted
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_delete_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_returned numeric;
begin
  v_returned := public.bubatrent_give_back_booking_credit(
    old,
    case when old.deposit_status = 'verified' then 'Deposit returned: booking deleted'
         else 'Booking deleted: credit returned' end);

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (
    auth.uid(), 'DELETE_BOOKING', 'booking', old.id,
    jsonb_build_object(
      'status', old.status,
      'customer', old.customer_name,
      'customer_id', old.user_id,
      'car_id', old.car_id,
      'dates', old.pickup_date || ' → ' || old.return_date,
      'total', old.total_price,
      'deposit', old.deposit_amount,
      'deposit_status', old.deposit_status,
      'full_payment_status', old.full_payment_status,
      'credit_returned', v_returned,
      'by', case when auth.uid() is null then 'system'
                 when public.bubatrent_is_admin() then 'admin' else 'customer' end));

  return old;
end;
$$;

revoke all on function public.bubatrent_delete_booking() from public, anon, authenticated;

drop trigger if exists bubatrent_delete_booking on public.bubatrent_booking_bookings;
create trigger bubatrent_delete_booking
  before delete on public.bubatrent_booking_bookings
  for each row execute function public.bubatrent_delete_booking();

-- ---------------------------------------------------------------------
-- 4. The credit ledger is append-only from the website
-- ---------------------------------------------------------------------
drop policy if exists "Admins can delete credit transactions"
  on public.bubatrent_booking_credit_transactions;

commit;
