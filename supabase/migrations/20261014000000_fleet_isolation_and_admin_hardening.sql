-- =====================================================================
-- Fleet isolation + admin hardening (2026-10-14)
--
-- What this fixes:
--   * bubatrent_is_admin() is platform-wide, so an admin of one fleet
--     could read and edit every other fleet's cars, bookings, payments,
--     credit ledger, expenses and rental agreements. The admin screens
--     filtered by fleet, the database did not.
--   * admin_create_walk_in_customer() took the user id from the browser
--     and upserted on it, so any admin could overwrite an existing
--     account's identity details or reset a super admin to 'customer'
--     (the function runs as its owner, so the role trigger never fired).
--   * Rental agreements were inserted straight from the browser, so the
--     signed prices, name and IC came from the client and the booking was
--     never checked to belong to the signer.
--
-- Customer profiles stay a shared pool on purpose: any admin can find and
-- verify a customer, and sensitive edits go through change requests.
--
-- Fleet scoping is added as RESTRICTIVE policies. Postgres ANDs them with
-- whatever permissive policies already exist, so this holds even where the
-- live policies have drifted from the repo. Customers are unaffected: the
-- restriction only applies to admins.
--
-- Deploy order: safe to run before the frontend ships, except section 3
-- (rental agreements) which needs the matching RentalAgreement.jsx.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------
-- Super admins see every fleet; everyone else only fleets they belong to.
create or replace function public.bubatrent_can_access_fleet(p_fleet_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.bubatrent_is_super_admin()
      or exists (
        select 1 from public.bubatrent_booking_fleet_memberships
         where user_id = auth.uid() and fleet_group_id = p_fleet_group_id
      );
$$;

-- The booking's own customer, or staff of the booking's fleet.
create or replace function public.bubatrent_can_access_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bubatrent_booking_bookings b
     where b.id = p_booking_id
       and (b.user_id = auth.uid() or public.bubatrent_can_access_fleet(b.fleet_group_id))
  );
$$;

revoke all on function public.bubatrent_can_access_fleet(uuid) from public, anon;
revoke all on function public.bubatrent_can_access_booking(uuid) from public, anon;
grant execute on function public.bubatrent_can_access_fleet(uuid) to authenticated;
grant execute on function public.bubatrent_can_access_booking(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Restrict admins to their own fleets
-- ---------------------------------------------------------------------
-- Bookings: admins keep their own bookings as customers.
drop policy if exists "Admins limited to their fleets" on public.bubatrent_booking_bookings;
create policy "Admins limited to their fleets"
  on public.bubatrent_booking_bookings as restrictive for all to authenticated
  using (
    not public.bubatrent_is_admin()
    or user_id = (select auth.uid())
    or public.bubatrent_can_access_fleet(fleet_group_id)
  )
  with check (
    not public.bubatrent_is_admin()
    or user_id = (select auth.uid())
    or public.bubatrent_can_access_fleet(fleet_group_id)
  );

-- Cars stay publicly listed; only writes are scoped.
drop policy if exists "Admins insert cars in their fleets" on public.bubatrent_booking_cars;
create policy "Admins insert cars in their fleets"
  on public.bubatrent_booking_cars as restrictive for insert to authenticated
  with check (public.bubatrent_can_access_fleet(fleet_group_id));

drop policy if exists "Admins update cars in their fleets" on public.bubatrent_booking_cars;
create policy "Admins update cars in their fleets"
  on public.bubatrent_booking_cars as restrictive for update to authenticated
  using (public.bubatrent_can_access_fleet(fleet_group_id))
  with check (public.bubatrent_can_access_fleet(fleet_group_id));

drop policy if exists "Admins delete cars in their fleets" on public.bubatrent_booking_cars;
create policy "Admins delete cars in their fleets"
  on public.bubatrent_booking_cars as restrictive for delete to authenticated
  using (public.bubatrent_can_access_fleet(fleet_group_id));

drop policy if exists "Admins limited to their fleets" on public.bubatrent_booking_payments;
create policy "Admins limited to their fleets"
  on public.bubatrent_booking_payments as restrictive for all to authenticated
  using (
    not public.bubatrent_is_admin()
    or public.bubatrent_can_access_booking(booking_id)
    or (booking_id is null and public.bubatrent_can_access_fleet(fleet_group_id))
  )
  with check (
    not public.bubatrent_is_admin()
    or public.bubatrent_can_access_booking(booking_id)
    or (booking_id is null and public.bubatrent_can_access_fleet(fleet_group_id))
  );

-- Credit rows without a fleet are visible to super admins and their owner.
drop policy if exists "Admins limited to their fleets" on public.bubatrent_booking_credit_transactions;
create policy "Admins limited to their fleets"
  on public.bubatrent_booking_credit_transactions as restrictive for all to authenticated
  using (
    not public.bubatrent_is_admin()
    or user_id = (select auth.uid())
    or public.bubatrent_can_access_fleet(fleet_group_id)
  )
  with check (
    not public.bubatrent_is_admin()
    or user_id = (select auth.uid())
    or public.bubatrent_can_access_fleet(fleet_group_id)
  );

drop policy if exists "Admins limited to their fleets" on public.bubatrent_booking_expense_claims;
create policy "Admins limited to their fleets"
  on public.bubatrent_booking_expense_claims as restrictive for all to authenticated
  using (public.bubatrent_can_access_fleet(fleet_group_id))
  with check (public.bubatrent_can_access_fleet(fleet_group_id));

drop policy if exists "Admins limited to their fleets" on public.bubatrent_booking_expense_images;
create policy "Admins limited to their fleets"
  on public.bubatrent_booking_expense_images as restrictive for all to authenticated
  using (
    exists (
      select 1 from public.bubatrent_booking_expense_claims c
       where c.id = claim_id and public.bubatrent_can_access_fleet(c.fleet_group_id)
    )
  )
  with check (
    exists (
      select 1 from public.bubatrent_booking_expense_claims c
       where c.id = claim_id and public.bubatrent_can_access_fleet(c.fleet_group_id)
    )
  );

-- ---------------------------------------------------------------------
-- 3. Rental agreements: built from the booking, signed through an RPC
-- ---------------------------------------------------------------------
drop policy if exists "Customers can sign their own agreement" on public.bubatrent_booking_rental_agreements;

-- Previously limited to fleet_admin, so super admins and fleet staff
-- could not open a signed agreement.
drop policy if exists "Admins can view fleet agreements" on public.bubatrent_booking_rental_agreements;
create policy "Admins can view fleet agreements"
  on public.bubatrent_booking_rental_agreements for select to authenticated
  using (public.bubatrent_is_admin() and public.bubatrent_can_access_booking(booking_id));

create or replace function public.bubatrent_sign_rental_agreement(
  p_booking_id uuid,
  p_signature_data text
)
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

  select * into v_booking from public.bubatrent_booking_bookings
   where id = p_booking_id and user_id = v_uid;
  if not found then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;
  if v_booking.status not in ('DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'RETURNED') then
    raise exception 'This booking cannot be signed right now.' using errcode = '22023';
  end if;

  select * into v_car from public.bubatrent_booking_cars where id = v_booking.car_id;
  select * into v_profile from public.bubatrent_booking_profiles where id = v_uid;

  -- First address in X-Forwarded-For is the client. The setting is unset or
  -- '' outside an API request, and ''::json would raise.
  v_ip := nullif(trim(split_part(coalesce(
    nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ''), ',', 1)), '');

  begin
    insert into public.bubatrent_booking_rental_agreements (
      booking_id, customer_id, customer_name, customer_ic, customer_phone,
      car_model, car_plate, pickup_date, return_date, rental_rate,
      total_price, deposit_amount, signature_data, ip_address
    ) values (
      v_booking.id,
      v_uid,
      coalesce(nullif(v_profile.display_name, ''), v_booking.customer_name, v_profile.email),
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
      v_ip
    )
    returning * into v_agreement;
  exception when unique_violation then
    raise exception 'This booking has already been signed.' using errcode = '23505';
  end;

  return v_agreement;
end;
$$;

revoke all on function public.bubatrent_sign_rental_agreement(uuid, text) from public, anon;
grant execute on function public.bubatrent_sign_rental_agreement(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Walk-in customers: create only, never overwrite
-- ---------------------------------------------------------------------
-- Same signature as before so the frontend call is unchanged. p_admin_id
-- is ignored; the acting admin is always auth.uid().
create or replace function public.admin_create_walk_in_customer(
  p_id uuid,
  p_display_name text,
  p_ic_number text,
  p_phone text,
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_state text,
  p_postcode text,
  p_licence_expiry date,
  p_ic_file_path text,
  p_licence_file_path text,
  p_admin_id uuid,
  p_email text default null,
  p_gdl_license text default 'NONE'
)
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
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, created_at, updated_at
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
    now()
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

revoke all on function public.admin_create_walk_in_customer(
  uuid, text, text, text, text, text, text, text, text, date, text, text, uuid, text, text
) from public, anon;
grant execute on function public.admin_create_walk_in_customer(
  uuid, text, text, text, text, text, text, text, text, date, text, text, uuid, text, text
) to authenticated;

commit;
