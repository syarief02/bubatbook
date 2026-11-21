-- =====================================================================
-- A deposit only comes back as credit if it was actually paid (2026-11-21)
--
-- Before: bubatrent_booking_deposit_due gave back the whole deposit of any
-- booking whose deposit_status was 'verified'. A Counter booking recorded
-- before 10 Nov 2026 14:42 (commit 2b88507) was marked 'verified' even when
-- the deposit was still to be paid at pick-up. Deleting such a booking
-- (BE7E6EB7, MK Audio, 10 Nov) credited the customer RM100 that was never
-- received.
--
-- Now:
-- 1. The deposit given back (on return, cancel, delete, settle) is capped
--    at the deposit money recorded as received: the booking's completed
--    'deposit' payments. Every current path that verifies a deposit writes
--    one (online deposit, Verify deposit, Receive deposit, the Counter), so
--    real deposits come back as before. Credit the customer applied to the
--    deposit is part of that payment row, so it still comes back too.
--    Nothing paid -> nothing credited.
-- 2. A booking's payments are deleted together with the booking (ON DELETE
--    CASCADE). The delete trigger runs BEFORE the row goes, so it still sees
--    the payments when it works out what to give back. Before, the admin
--    page deleted the payments first, which under the new rule would have
--    hidden a real deposit.
-- 3. Admins can no longer delete payment rows by hand (policy dropped):
--    payments go only with their booking. An admin page still open from
--    before this change deletes nothing in its first step, then the
--    booking delete removes the payments the right way.
-- =====================================================================

begin;

-- 1. Only deposit money actually received comes back
create or replace function public.bubatrent_booking_deposit_due(p_booking public.bubatrent_booking_bookings)
returns numeric
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_applied numeric;
  v_received numeric;
begin
  if p_booking.user_id is null or p_booking.deposit_credited_at is not null then
    return 0;
  end if;
  if p_booking.deposit_status = 'verified' then
    select coalesce(-sum(t.amount), 0) into v_applied
      from public.bubatrent_booking_credit_transactions t
     where t.booking_id = p_booking.id and t.type = 'applied';
    -- A deposit marked verified without a completed deposit payment was
    -- never received: give back nothing for it.
    select coalesce(sum(p.amount), 0) into v_received
      from public.bubatrent_booking_payments p
     where p.booking_id = p_booking.id
       and p.payment_type = 'deposit'
       and p.status = 'completed';
    return greatest(least(
      coalesce(p_booking.deposit_amount, 0)
        - greatest(v_applied - coalesce(p_booking.credit_applied, 0), 0),
      v_received), 0);
  end if;
  return greatest(coalesce(p_booking.credit_applied, 0), 0);
end;
$$;

-- 2. Payments go with their booking, after the delete trigger has read them
alter table public.bubatrent_booking_payments
  drop constraint bubatrent_booking_payments_booking_id_fkey;
alter table public.bubatrent_booking_payments
  add constraint bubatrent_booking_payments_booking_id_fkey
  foreign key (booking_id) references public.bubatrent_booking_bookings(id) on delete cascade;

-- 3. No deleting payment rows by hand
drop policy if exists "Admins can delete payments" on public.bubatrent_booking_payments;

commit;
