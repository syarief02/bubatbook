-- =====================================================================
-- Long-term bookings per car (2026-11-02)
--
-- The owner, competing with Trevo: each car's listing can turn long-term
-- discounts on or off, as a Trevo host does, and a car can have its own
-- weekly/monthly discount instead of its fleet's.
--
--   * bubatrent_booking_cars.long_rental_enabled: off = no discount for any
--     length. On (the default, so existing cars keep their price) = the
--     car's own weekly_discount_pct / monthly_discount_pct, or the fleet's
--     where the car has none (null).
--   * bubatrent_car_long_rental_rates(car): the car's discounts, for the
--     pages' price estimates.
--   * bubatrent_rental_quote prices bookings with them (online checkout,
--     counter bookings, Book for Customer, extending a rental).
--
-- bubatrent_long_rental_rates(fleet) stays for pages loaded before this
-- deploy. Deploy order: run before the frontend ships.
-- =====================================================================

begin;

alter table public.bubatrent_booking_cars
  add column if not exists long_rental_enabled boolean not null default true,
  add column if not exists weekly_discount_pct numeric(5,2),
  add column if not exists monthly_discount_pct numeric(5,2);

alter table public.bubatrent_booking_cars
  drop constraint if exists bubatrent_booking_cars_long_rental_check;
alter table public.bubatrent_booking_cars
  add constraint bubatrent_booking_cars_long_rental_check
  check ((weekly_discount_pct is null or weekly_discount_pct between 0 and 90)
     and (monthly_discount_pct is null or monthly_discount_pct between 0 and 90));

-- A car's long-rental discounts: none when the car has long-term bookings
-- off, else its own, else its fleet's
create or replace function public.bubatrent_car_long_rental_rates(p_car_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'weekly_discount_pct',
      case when c.long_rental_enabled
           then coalesce(c.weekly_discount_pct, f.weekly_discount_pct, 0) else 0 end,
    'monthly_discount_pct',
      case when c.long_rental_enabled
           then coalesce(c.monthly_discount_pct, f.monthly_discount_pct, 0) else 0 end)
    from public.bubatrent_booking_cars c
    left join public.bubatrent_booking_fleet_groups f on f.id = c.fleet_group_id
   where c.id = p_car_id;
$$;

-- The price of renting a car for some days: the daily rate, less the
-- car's weekly (7+ days) or monthly (30+ days) discount
create or replace function public.bubatrent_rental_quote(p_car_id uuid, p_days integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'days', p_days, 'rate', c.price_per_day, 'base', x.base, 'discount_pct', x.pct,
    'long_discount', round(x.base * x.pct / 100, 2),
    'total', x.base - round(x.base * x.pct / 100, 2))
    from public.bubatrent_booking_cars c
    cross join lateral (select public.bubatrent_car_long_rental_rates(c.id) as r) d
    cross join lateral (
      select p_days * c.price_per_day as base,
             case when p_days >= 30 then (d.r->>'monthly_discount_pct')::numeric
                  when p_days >= 7 then (d.r->>'weekly_discount_pct')::numeric
                  else 0 end as pct) x
   where c.id = p_car_id;
$$;

revoke all on function public.bubatrent_rental_quote(uuid, integer) from public, anon, authenticated;
revoke all on function public.bubatrent_car_long_rental_rates(uuid) from public;
grant execute on function public.bubatrent_car_long_rental_rates(uuid) to anon, authenticated;

commit;
