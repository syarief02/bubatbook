-- =====================================================================
-- The car page's calendar greys out the days a car is booked (2026-11-12)
--
-- The owner: grey out the dates when the car is not available, like other
-- booking sites, so customers don't have to guess which dates are free.
--
--   * bubatrent_car_booked_days(car) lists the date ranges (first day,
--     last day, both included) the car is taken from today on. Anyone can
--     call it, signed in or not, like bubatrent_check_availability.
--   * Only the dates: not who booked, the price or the booking's status.
--   * Same rule as bubatrent_check_availability, so the calendar and the
--     booking check agree: HOLD (until it expires), DEPOSIT_PAID (until an
--     unverified deposit's review time runs out), CONFIRMED and PICKUP
--     bookings; a replacement car counts from the day it was handed over
--     (car_since). The return day is taken too, as in the check.
--   * The check itself is unchanged and still decides at booking time.
--
-- Deploy order: run before the frontend ships. The frontend shows the
-- calendar without grey days if this function is missing.
-- =====================================================================

begin;

create or replace function public.bubatrent_car_booked_days(p_car_id uuid)
returns table (from_date date, to_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(b.car_since, b.pickup_date), b.return_date
    from public.bubatrent_booking_bookings b
   where b.car_id = p_car_id
     and b.status in ('HOLD', 'DEPOSIT_PAID', 'CONFIRMED', 'PICKUP')
     and not (b.status = 'HOLD' and b.hold_expires_at < now())
     and not (b.status = 'DEPOSIT_PAID'
              and coalesce(b.deposit_status, '') <> 'verified'
              and b.deposit_review_due_at < now())
     and b.return_date >= (now() at time zone 'Asia/Kuala_Lumpur')::date
   order by 1, 2;
$$;

revoke all on function public.bubatrent_car_booked_days(uuid) from public;
grant execute on function public.bubatrent_car_booked_days(uuid) to anon, authenticated;

commit;
