-- Package prices per car (Bocah Trading's rates, 19 Nov 2026): a car can have
--   rate_packages   [{"days":1,"total":200},{"days":3,"total":500},...]: the price
--                   for that many days. Other lengths are the largest package that
--                   fits, pro rata to whole ringgit, never more than the next package.
--                   With packages the weekly/monthly discounts don't apply.
--   max_rental_days the longest rental allowed (e.g. 14)
--   fixed_deposit   a fixed deposit instead of 30% (min RM100)
-- Cars without them are priced as before.

alter table public.bubatrent_booking_cars
  add column if not exists rate_packages jsonb,
  add column if not exists max_rental_days integer,
  add column if not exists fixed_deposit numeric(10,2);

alter table public.bubatrent_booking_cars
  drop constraint if exists bubatrent_cars_rate_packages_array,
  add constraint bubatrent_cars_rate_packages_array
    check (rate_packages is null or jsonb_typeof(rate_packages) = 'array'),
  drop constraint if exists bubatrent_cars_max_rental_days_positive,
  add constraint bubatrent_cars_max_rental_days_positive
    check (max_rental_days is null or max_rental_days > 0),
  drop constraint if exists bubatrent_cars_fixed_deposit_positive,
  add constraint bubatrent_cars_fixed_deposit_positive
    check (fixed_deposit is null or fixed_deposit >= 0);

-- The car's long-rental terms for the website: discounts, packages, max days, deposit
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
           then coalesce(c.monthly_discount_pct, f.monthly_discount_pct, 0) else 0 end,
    'packages', c.rate_packages,
    'max_days', c.max_rental_days,
    'fixed_deposit', c.fixed_deposit)
    from public.bubatrent_booking_cars c
    left join public.bubatrent_booking_fleet_groups f on f.id = c.fleet_group_id
   where c.id = p_car_id;
$$;

-- The price of renting a car for some days: its packages if it has them, else
-- the daily rate less the weekly (7+ days) or monthly (30+ days) discount
create or replace function public.bubatrent_rental_quote(p_car_id uuid, p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.bubatrent_booking_cars;
  r jsonb;
  v_base numeric;
  v_pct numeric;
  v_total numeric;
  v_tier jsonb;
  v_next numeric;
begin
  select * into c from public.bubatrent_booking_cars where id = p_car_id;
  if not found then
    return null;
  end if;
  if c.max_rental_days is not null and p_days > c.max_rental_days then
    raise exception 'This car can be rented for at most % days. Choose an earlier return date.',
      c.max_rental_days using errcode = '22023';
  end if;
  v_base := p_days * c.price_per_day;

  if jsonb_typeof(c.rate_packages) = 'array' and jsonb_array_length(c.rate_packages) > 0 then
    select e into v_tier from jsonb_array_elements(c.rate_packages) e
     where (e->>'days')::int <= p_days order by (e->>'days')::int desc limit 1;
    if v_tier is null then
      select e into v_tier from jsonb_array_elements(c.rate_packages) e
       order by (e->>'days')::int asc limit 1;
    end if;
    if (v_tier->>'days')::int = p_days then
      v_total := (v_tier->>'total')::numeric;
    else
      v_total := round((v_tier->>'total')::numeric * p_days / (v_tier->>'days')::int, 0);
    end if;
    select min((e->>'total')::numeric) into v_next from jsonb_array_elements(c.rate_packages) e
     where (e->>'days')::int > p_days;
    if v_next is not null and v_next < v_total then
      v_total := v_next;
    end if;
    v_pct := case when v_base > 0 then round((v_base - v_total) * 100 / v_base, 2) else 0 end;
    return jsonb_build_object('days', p_days, 'rate', c.price_per_day, 'base', v_base,
      'discount_pct', v_pct, 'long_discount', v_base - v_total, 'total', v_total, 'package', true);
  end if;

  r := public.bubatrent_car_long_rental_rates(c.id);
  v_pct := case when p_days >= 30 then (r->>'monthly_discount_pct')::numeric
                when p_days >= 7 then (r->>'weekly_discount_pct')::numeric
                else 0 end;
  return jsonb_build_object('days', p_days, 'rate', c.price_per_day, 'base', v_base,
    'discount_pct', v_pct, 'long_discount', round(v_base * v_pct / 100, 2),
    'total', v_base - round(v_base * v_pct / 100, 2));
end;
$$;

revoke all on function public.bubatrent_rental_quote(uuid, integer) from public, anon, authenticated;
revoke all on function public.bubatrent_car_long_rental_rates(uuid) from public;
grant execute on function public.bubatrent_car_long_rental_rates(uuid) to anon, authenticated;

-- Online bookings: the car's fixed deposit if it has one (only change from 20261108)
CREATE OR REPLACE FUNCTION public.bubatrent_create_hold_booking(p_car_id uuid, p_pickup date, p_return date)
 RETURNS bubatrent_booking_bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_profile public.bubatrent_booking_profiles;
  v_car public.bubatrent_booking_cars;
  v_days integer;
  v_quote jsonb;
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
  if v_profile.bank_account_number is null then
    raise exception 'Please add your bank details in your profile before booking.'
      using errcode = '42501';
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

  -- Commercial vehicles (the panel vans): the driver needs a GDL that is
  -- valid until the return date
  if coalesce(v_car.requires_gdl, false) then
    if v_profile.gdl_expiry is null then
      raise exception 'This is a commercial vehicle: you need a valid GDL (Goods Driving Licence) to rent it. Add your GDL in Verify Account, then book again.'
        using errcode = '42501';
    elsif v_profile.gdl_expiry < p_return then
      raise exception 'Your GDL expires on %, before the return date. Renew it in Verify Account, or choose an earlier return date.',
        to_char(v_profile.gdl_expiry, 'DD/MM/YYYY')
        using errcode = '42501';
    end if;
  end if;

  -- Free dates held by abandoned checkouts and by deposits not verified in
  -- time.
  update public.bubatrent_booking_bookings
     set status = 'EXPIRED', updated_at = now()
   where status = 'HOLD' and hold_expires_at < now();
  perform public.bubatrent_release_unverified_deposits();

  -- Back at checkout for the same car and dates: carry on with that hold
  select * into v_booking
    from public.bubatrent_booking_bookings
   where user_id = v_uid and status = 'HOLD' and car_id = v_car.id
     and pickup_date = p_pickup and return_date = p_return
     and hold_expires_at >= now()
   order by created_at desc
   limit 1
   for update;
  if found then
    return v_booking;
  end if;

  -- Release this customer's other holds (one car at a time)
  update public.bubatrent_booking_bookings
     set status = 'CANCELLED', updated_at = now()
   where status = 'HOLD' and user_id = v_uid;

  v_days := p_return - p_pickup;
  v_quote := public.bubatrent_rental_quote(v_car.id, v_days);
  v_total := (v_quote->>'total')::numeric;

  begin
    insert into public.bubatrent_booking_bookings (
      car_id, user_id, pickup_date, return_date, total_price, deposit_amount,
      status, hold_expires_at, fleet_group_id, long_rental_discount
    ) values (
      v_car.id, v_uid, p_pickup, p_return, v_total, coalesce(v_car.fixed_deposit, greatest(100, ceil(v_total * 0.3))),
      'HOLD',
      least(now() + interval '24 hours', (p_pickup + 1)::timestamp at time zone 'Asia/Kuala_Lumpur'),
      v_car.fleet_group_id,
      (v_quote->>'long_discount')::numeric
    )
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'Sorry, this car was just booked for those dates. Please choose different dates.'
      using errcode = 'P0001';
  end;

  return v_booking;
end;
$function$;
