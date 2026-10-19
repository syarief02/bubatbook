-- =====================================================================
-- A day to pay the deposit (2026-10-19)
--
-- Checkout held the car for 10 minutes, and signing the agreement gave
-- 10 more to pay. Paying means asking the admin for the bank account on
-- WhatsApp and waiting for the reply, so holds ran out while customers
-- were still paying; two paid bookings had to be brought back by hand.
-- Coming back to checkout also started a new hold, losing the signed
-- agreement.
--
-- Now bubatrent_create_hold_booking:
--   * holds the car for 24 hours, or until the pick-up day ends (Malaysia
--     time) if that is sooner, so a deposit can't come in for a rental
--     that should already have started;
--   * returns the customer's hold when they come back to checkout for the
--     same car and dates (its price and any agreement already signed
--     stay), instead of cancelling it and starting over. Starting checkout
--     for another car or other dates still releases their earlier hold, so
--     a customer holds one car at a time.
-- Signing still leaves at least 10 minutes to pay.
--
-- Deploy order: run before the frontend ships.
-- =====================================================================

begin;

create or replace function public.bubatrent_create_hold_booking(p_car_id uuid, p_pickup date, p_return date)
returns public.bubatrent_booking_bookings
language plpgsql
security definer
set search_path to ''
as $$
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
      v_car.id, v_uid, p_pickup, p_return, v_total, greatest(100, ceil(v_total * 0.3)),
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
$$;

commit;
