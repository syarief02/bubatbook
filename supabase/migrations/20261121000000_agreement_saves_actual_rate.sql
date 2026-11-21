-- =====================================================================
-- A signed agreement saves the rate the customer actually pays (2026-11-21)
--
-- Before: bubatrent_sign_rental_agreement saved the car's listed daily
-- price as rental_rate, e.g. RM450 for the Vellfire rented for a month at
-- RM4,000. The agreement page has shown the real rate since commit ac89f00
-- (the booking's rent over its days), so the signed copy disagreed with
-- what the customer read and signed.
--
-- Now: rental_rate = the booking's total_price / its days (return_date -
-- pickup_date, at least 1), rounded to sen: RM4,000 for 30 days saves
-- RM133.33. An agreed price (Change price), a package or a long-rental
-- discount is saved as charged. Agreements already signed keep what they
-- saved. Nothing else in the function changes; its grants are kept.
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
      -- The rate the customer pays: the rent over the days, as the agreement page shows it
      round(coalesce(v_booking.total_price, 0)
            / greatest(v_booking.return_date - v_booking.pickup_date, 1), 2),
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

commit;
