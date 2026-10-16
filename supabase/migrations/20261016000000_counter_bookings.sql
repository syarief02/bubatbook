-- =====================================================================
-- Counter bookings: signing in person, one checked "Book for Customer"
-- step, and walk-in logins that Supabase Auth can load (2026-10-16)
--
-- Found by a live test of the admin "Book for Customer" flow:
--   * Only the booking's customer, signed in, could sign the rental
--     agreement, and pickup needs a signed agreement. A walk-in customer
--     without an account could not be handed a car until they signed up
--     and linked their record.
--   * Book for Customer wrote the booking, its payment and the audit entry
--     from the browser in separate steps. It accepted customers who were
--     not verified (or whose licence had expired) and never used the
--     customer's credit.
--   * Create Customer inserted the walk-in's login with NULL token fields.
--     Supabase Auth cannot load such a row ("Database error loading
--     user"), so a walk-in given an email could not use Forgot password,
--     and the login could not be removed from the dashboard.
--
-- Now:
--   * bubatrent_sign_rental_agreement also lets an admin of the booking's
--     fleet record the customer's signature taken in person on the staff
--     device. The agreement is the customer's (customer_id, name, IC from
--     their profile); signed_in_person_by records the staff member. Every
--     signing is in the audit log (SIGN_AGREEMENT).
--   * bubatrent_admin_create_booking makes a counter booking in one step:
--     verified customer with an unexpired licence, free dates, price from
--     the car's daily rate, deposit at least RM100, optional credit
--     towards the deposit, payment record and audit entry.
--   * admin_create_walk_in_customer writes '' in those token fields, and
--     existing logins with NULLs are repaired.
--
-- Deploy order: run before the frontend ships.
-- =====================================================================

begin;

-- ------------------------------------------------------- walk-in logins
update auth.users
   set confirmation_token = coalesce(confirmation_token, ''),
       recovery_token = coalesce(recovery_token, ''),
       email_change_token_new = coalesce(email_change_token_new, ''),
       email_change = coalesce(email_change, '')
 where confirmation_token is null
    or recovery_token is null
    or email_change_token_new is null
    or email_change is null;

create or replace function public.admin_create_walk_in_customer(
  p_id uuid, p_display_name text, p_ic_number text, p_phone text,
  p_address_line1 text, p_address_line2 text, p_city text, p_state text, p_postcode text,
  p_licence_expiry date, p_ic_file_path text, p_licence_file_path text, p_admin_id uuid,
  p_email text default null, p_gdl_license text default 'NONE')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_admin uuid := auth.uid();
begin
  if not public.bubatrent_is_admin() then
    raise exception 'Not authorized: admin role required' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'Missing customer id' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users where id = p_id)
     or exists (select 1 from public.bubatrent_booking_profiles where id = p_id) then
    raise exception 'A customer with this id already exists' using errcode = '23505';
  end if;
  if (p_ic_file_path is not null and p_ic_file_path not like 'verification/' || p_id::text || '/%')
     or (p_licence_file_path is not null and p_licence_file_path not like 'verification/' || p_id::text || '/%') then
    raise exception 'Invalid document path' using errcode = '22023';
  end if;

  if p_email is not null and trim(p_email) <> '' then
    v_email := lower(trim(p_email));
  else
    v_email := 'walkin_' || p_id || '@bubatrent.local';
  end if;

  -- The customer sets their own password later via "Forgot password".
  -- Supabase Auth needs '' (not NULL) in the token columns to load the row.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    p_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(encode(extensions.gen_random_bytes(32), 'base64'), extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('name', p_display_name, 'is_walk_in', true),
    now(),
    now(),
    '', '', '', ''
  );

  -- handle_new_user() has created a bare profile; fill it in.
  insert into public.bubatrent_booking_profiles (
    id, display_name, ic_number, phone, email,
    address_line1, address_line2, address_city, address_state, address_postcode,
    city, state, postcode, licence_expiry, gdl_license,
    ic_file_path, licence_file_path, created_by_admin, verified_by, verified_at,
    is_verified, role
  ) values (
    p_id, p_display_name, p_ic_number, p_phone, v_email,
    p_address_line1, p_address_line2, p_city, p_state, p_postcode,
    p_city, p_state, p_postcode, p_licence_expiry, coalesce(p_gdl_license, 'NONE'),
    p_ic_file_path, p_licence_file_path, v_admin, v_admin, now(),
    true, 'customer'
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    ic_number = excluded.ic_number,
    phone = excluded.phone,
    email = excluded.email,
    address_line1 = excluded.address_line1,
    address_line2 = excluded.address_line2,
    address_city = excluded.address_city,
    address_state = excluded.address_state,
    address_postcode = excluded.address_postcode,
    city = excluded.city,
    state = excluded.state,
    postcode = excluded.postcode,
    licence_expiry = excluded.licence_expiry,
    gdl_license = excluded.gdl_license,
    ic_file_path = excluded.ic_file_path,
    licence_file_path = excluded.licence_file_path,
    created_by_admin = excluded.created_by_admin,
    verified_by = excluded.verified_by,
    verified_at = excluded.verified_at,
    is_verified = true,
    role = 'customer';
end;
$$;

-- ------------------------------------------------ signing in person
alter table public.bubatrent_booking_rental_agreements
  add column if not exists signed_in_person_by uuid
    references public.bubatrent_booking_profiles(id) on delete set null;

comment on column public.bubatrent_booking_rental_agreements.signed_in_person_by is
  'Staff member who took the customer''s signature in person on their device; null when the customer signed in their own account.';

create or replace function public.bubatrent_sign_rental_agreement(p_booking_id uuid, p_signature_data text)
returns public.bubatrent_booking_rental_agreements
language plpgsql
security definer
set search_path = ''
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

  select * into v_booking from public.bubatrent_booking_bookings where id = p_booking_id;
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
  if v_booking.status not in ('DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'RETURNED') then
    raise exception 'This booking cannot be signed right now.' using errcode = '22023';
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

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (
    v_uid, 'SIGN_AGREEMENT', 'booking', v_booking.id,
    jsonb_build_object('by', case when v_in_person then 'admin' else 'customer' end,
                       'in_person', v_in_person, 'customer_name', v_agreement.customer_name)
  );

  return v_agreement;
end;
$$;

-- ------------------------------------------------ Book for Customer
create or replace function public.bubatrent_admin_create_booking(
  p_customer_id uuid, p_car_id uuid, p_pickup date, p_return date,
  p_deposit numeric, p_status text, p_receipt_path text default null,
  p_use_credit boolean default false, p_notes text default null)
returns public.bubatrent_booking_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_receipt text := nullif(trim(coalesce(p_receipt_path, '')), '');
  v_car public.bubatrent_booking_cars;
  v_cust public.bubatrent_booking_profiles;
  v_total numeric;
  v_applied numeric := 0;
  v_due numeric;
  v_verified boolean;
  v_booking public.bubatrent_booking_bookings;
begin
  if not public.bubatrent_is_admin() then
    raise exception 'Not authorized: admin role required' using errcode = '42501';
  end if;

  select * into v_car from public.bubatrent_booking_cars where id = p_car_id;
  if not found or not public.bubatrent_can_access_fleet(v_car.fleet_group_id) then
    raise exception 'Car not found.' using errcode = 'P0002';
  end if;
  if v_car.is_available is false then
    raise exception 'This car is marked unavailable.' using errcode = '22023';
  end if;

  select * into v_cust from public.bubatrent_booking_profiles where id = p_customer_id for update;
  if not found then
    raise exception 'Customer not found.' using errcode = 'P0002';
  end if;
  if not coalesce(v_cust.is_verified, false) then
    raise exception 'Verify this customer first: check their IC and licence on the Customers page.'
      using errcode = '22023';
  end if;
  if v_cust.licence_expiry is not null and v_cust.licence_expiry < v_today then
    raise exception 'This customer''s driving licence has expired. Update it on the Customers page first.'
      using errcode = '22023';
  end if;

  if p_status is null or p_status not in ('DEPOSIT_PAID', 'CONFIRMED') then
    raise exception 'Initial status must be Deposit Paid or Confirmed.' using errcode = '22023';
  end if;
  if p_pickup is null or p_return is null or p_return <= p_pickup then
    raise exception 'Return date must be after the pick-up date.' using errcode = '22023';
  end if;
  if p_pickup < v_today then
    raise exception 'Pick-up date cannot be in the past.' using errcode = '22023';
  end if;
  if p_deposit is null or p_deposit < 100 then
    raise exception 'The deposit must be at least RM100.' using errcode = '22023';
  end if;
  if v_receipt is not null and v_receipt not like 'receipts/%' then
    raise exception 'Invalid receipt path.' using errcode = '22023';
  end if;

  -- Free dates held by abandoned checkouts and by deposits not verified in time
  update public.bubatrent_booking_bookings
     set status = 'EXPIRED', updated_at = now()
   where status = 'HOLD' and hold_expires_at < now();
  perform public.bubatrent_release_unverified_deposits();

  v_total := (p_return - p_pickup) * v_car.price_per_day;
  if coalesce(p_use_credit, false) then
    v_applied := least(greatest(coalesce(v_cust.deposit_credit, 0), 0), p_deposit);
  end if;
  v_due := p_deposit - v_applied;
  -- Confirmed means staff have the deposit; credit covering all of it needs no check.
  v_verified := p_status = 'CONFIRMED' or v_due = 0;

  begin
    insert into public.bubatrent_booking_bookings (
      car_id, user_id, pickup_date, return_date, total_price, deposit_amount, status,
      fleet_group_id, customer_name, customer_email, customer_phone, notes,
      deposit_receipt_path, deposit_status, credit_applied, full_payment_amount
    ) values (
      v_car.id, v_cust.id, p_pickup, p_return, v_total, p_deposit, p_status,
      v_car.fleet_group_id,
      coalesce(v_cust.display_name, ''),
      case when v_cust.email like '%@bubatrent.local' then '' else coalesce(v_cust.email, '') end,
      coalesce(v_cust.phone, ''),
      trim(coalesce(p_notes, '')),
      v_receipt,
      case when v_verified then 'verified' when v_receipt is not null then 'uploaded' else 'pending' end,
      v_applied,
      v_total
    )
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'Those dates overlap another booking for this car.' using errcode = '23P01';
  end;

  -- Deposit payment: completed when received, pending while a receipt waits
  -- to be checked. A cash deposit not yet received gets its record from
  -- Mark Deposit Received.
  if v_verified or v_receipt is not null then
    insert into public.bubatrent_booking_payments (
      booking_id, amount, payment_method, status, simulated, payment_type,
      receipt_path, reference_number, fleet_group_id
    ) values (
      v_booking.id, p_deposit,
      case when v_receipt is not null then 'bank_transfer' when v_due = 0 then 'credit' else 'cash' end,
      case when v_verified then 'completed' else 'pending' end,
      false, 'deposit', v_receipt,
      'ADMIN-' || upper(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint)),
      v_car.fleet_group_id
    );
  end if;

  if v_applied > 0 then
    update public.bubatrent_booking_profiles
       set deposit_credit = coalesce(deposit_credit, 0) - v_applied
     where id = v_cust.id;
    insert into public.bubatrent_booking_credit_transactions (
      user_id, booking_id, amount, type, description, fleet_group_id
    ) values (
      v_cust.id, v_booking.id, -v_applied, 'applied', 'Credit applied to booking deposit',
      v_car.fleet_group_id
    );
  end if;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (
    v_uid, 'ADMIN_CREATE_BOOKING', 'booking', v_booking.id,
    jsonb_build_object(
      'by', 'admin', 'customer_id', v_cust.id, 'car_id', v_car.id,
      'dates', p_pickup || ' → ' || p_return, 'status', p_status,
      'total', v_total, 'deposit', p_deposit, 'credit_applied', v_applied)
  );

  return v_booking;
end;
$$;

revoke all on function public.bubatrent_admin_create_booking(uuid, uuid, date, date, numeric, text, text, boolean, text)
  from public, anon;
grant execute on function public.bubatrent_admin_create_booking(uuid, uuid, date, date, numeric, text, text, boolean, text)
  to authenticated;

commit;
