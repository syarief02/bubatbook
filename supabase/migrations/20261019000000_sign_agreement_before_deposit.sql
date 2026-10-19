-- =====================================================================
-- Customers sign the rental agreement at checkout, on their own device,
-- before they pay the deposit (2026-10-19)
--
-- Before: an online customer could only sign once the booking was
-- confirmed (My Bookings → Agreement), so many reached pickup unsigned and
-- staff had to send the link or use Sign at Counter.
--
-- Now:
--   * bubatrent_sign_rental_agreement also accepts a HOLD booking (the
--     checkout), signed by the customer themselves while the hold lasts.
--     Staff can't sign a hold in person. Signing gives the customer a
--     fresh 10 minutes to pay the deposit, since reading and signing takes
--     part of the hold.
--   * bubatrent_submit_booking_deposit refuses a deposit until the
--     booking's agreement is signed.
--   Counter bookings (bubatrent_admin_create_booking) are unchanged: they
--   start at DEPOSIT_PAID or CONFIRMED and are signed at the counter or by
--   the customer from My Bookings.
--
-- Deploy order: run before the frontend ships (the old checkout has no
-- agreement step, so a deposit sent from it is refused until the page is
-- reloaded).
-- =====================================================================

begin;

create or replace function public.bubatrent_sign_rental_agreement(p_booking_id uuid, p_signature_data text)
returns public.bubatrent_booking_rental_agreements
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bubatrent_booking_bookings;
  v_car public.bubatrent_booking_cars;
  v_profile public.bubatrent_booking_profiles;
  v_agreement public.bubatrent_booking_rental_agreements;
  v_in_person boolean;
  v_ip text;
begin
  if v_uid is null then
    raise exception 'Please log in again.' using errcode = '28000';
  end if;
  if p_signature_data is null
     or p_signature_data not like 'data:image/png;base64,%'
     or length(p_signature_data) > 500000 then
    raise exception 'Please sign the agreement again.' using errcode = '22023';
  end if;

  select * into v_booking from public.bubatrent_booking_bookings where id = p_booking_id for update;
  if not found or v_booking.user_id is null then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;
  -- The customer signs in their own account. Staff of the booking's fleet
  -- may instead take the customer's signature in person on their device.
  v_in_person := v_booking.user_id <> v_uid
                 and coalesce(public.bubatrent_is_admin(), false)
                 and coalesce(public.bubatrent_can_access_fleet(v_booking.fleet_group_id), false);
  if v_booking.user_id <> v_uid and not v_in_person then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;
  if v_booking.status not in ('HOLD', 'DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'RETURNED')
     or (v_booking.status = 'HOLD' and v_in_person) then
    raise exception 'This booking cannot be signed right now.' using errcode = '22023';
  end if;
  -- At checkout the customer signs before paying the deposit, while the hold lasts
  if v_booking.status = 'HOLD' and v_booking.hold_expires_at < now() then
    raise exception 'Your hold has expired. Please start over.' using errcode = '22023';
  end if;

  select * into v_car from public.bubatrent_booking_cars where id = v_booking.car_id;
  select * into v_profile from public.bubatrent_booking_profiles where id = v_booking.user_id;

  -- First address in X-Forwarded-For is the client. The setting is unset or
  -- '' outside an API request, and ''::json would raise.
  v_ip := nullif(trim(split_part(coalesce(
    nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ''), ',', 1)), '');

  begin
    insert into public.bubatrent_booking_rental_agreements (
      booking_id, customer_id, customer_name, customer_ic, customer_phone,
      car_model, car_plate, pickup_date, return_date, rental_rate,
      total_price, deposit_amount, signature_data, ip_address, signed_in_person_by
    ) values (
      v_booking.id,
      v_booking.user_id,
      coalesce(nullif(v_profile.display_name, ''), nullif(v_booking.customer_name, ''),
               case when v_profile.email not like '%@bubatrent.local' then v_profile.email end, ''),
      coalesce(v_profile.ic_number, ''),
      coalesce(v_profile.phone, v_booking.customer_phone, ''),
      trim(coalesce(v_car.brand, '') || ' ' || coalesce(v_car.model, '')),
      coalesce(v_car.plate_number, ''),
      v_booking.pickup_date,
      v_booking.return_date,
      coalesce(v_car.price_per_day, 0),
      v_booking.total_price,
      v_booking.deposit_amount,
      p_signature_data,
      v_ip,
      case when v_in_person then v_uid end
    )
    returning * into v_agreement;
  exception when unique_violation then
    raise exception 'This booking has already been signed.' using errcode = '23505';
  end;

  -- Reading and signing used part of the hold: give a fresh 10 minutes to pay
  if v_booking.status = 'HOLD' then
    update public.bubatrent_booking_bookings
       set hold_expires_at = greatest(hold_expires_at, now() + interval '10 minutes')
     where id = v_booking.id;
  end if;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (
    v_uid, 'SIGN_AGREEMENT', 'booking', v_booking.id,
    jsonb_build_object('by', case when v_in_person then 'admin' else 'customer' end,
                       'in_person', v_in_person, 'customer_name', v_agreement.customer_name)
  );

  return v_agreement;
end;
$$;

create or replace function public.bubatrent_submit_booking_deposit(p_booking_id uuid, p_receipt_path text)
returns public.bubatrent_booking_bookings
language plpgsql
security definer
set search_path to ''
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
  if not exists (
    select 1 from public.bubatrent_booking_rental_agreements a where a.booking_id = p_booking_id
  ) then
    raise exception 'Please sign the rental agreement before paying the deposit.'
      using errcode = '22023';
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

commit;
