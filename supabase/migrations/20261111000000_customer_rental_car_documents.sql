-- =====================================================================
-- Customers see the car's road tax, insurance and Puspakom while they
-- rent it (2026-11-11)
--
-- The owner: a customer should be able to view the road tax, Puspakom and
-- insurance of the car they are renting now (e.g. at a roadblock or after
-- an accident), without asking on WhatsApp. Decided with the owner: the
-- files are shown as uploaded, although the policies and receipts carry the
-- owner's name, IC number and address, and some show the price.
--
--   * Only during the rental: the booking is the customer's own, and either
--     the car is out (PICKUP, also when the return is overdue) or it is
--     CONFIRMED and today is between the pick-up and return dates.
--   * Only the document of each type that counts today: the one valid
--     today with the latest expiry date, or, if none is valid today, the
--     newest one (shown as expired). Earlier renewals are not shown.
--   * Road tax, insurance and Puspakom only; GPS stays with the admins.
--   * The customer gets the type, the dates, the insurer's name (without
--     the agent or runner in brackets) and the files. Not the cost, the
--     reference or who recorded it.
--   * The files open read-only, for the same customer and the same rental
--     period; storage checks this again on every file.
--
-- Applied on 11 Nov 2026 (by a test run before the owner's OK; the owner
-- then chose to keep it as it is).
--
-- Deploy order: run before the frontend ships. Nothing existing changes
-- for admins.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. The documents that count today for one car (internal, no grants)
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_car_current_documents(p_car_id uuid)
returns table (
  id uuid,
  doc_type text,
  valid_from date,
  valid_until date,
  provider text,
  file_paths text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (d.doc_type)
         d.id, d.doc_type, d.valid_from, d.valid_until,
         case when d.doc_type = 'insurance'
              then nullif(trim(regexp_replace(coalesce(d.provider, ''), '\s*\(.*$', '')), '')
         end,
         d.file_paths
    from public.bubatrent_booking_car_documents d
   where d.car_id = p_car_id
     and d.doc_type in ('road_tax', 'insurance', 'puspakom')
   order by d.doc_type,
            (coalesce(d.valid_from, d.valid_until)
               <= (now() at time zone 'Asia/Kuala_Lumpur')::date
             and d.valid_until >= (now() at time zone 'Asia/Kuala_Lumpur')::date) desc,
            d.valid_until desc,
            d.created_at desc;
$$;

revoke all on function public.bubatrent_car_current_documents(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Is this one of the caller's bookings, and is the rental on now?
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_is_my_current_rental(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bubatrent_booking_bookings b
     where b.id = p_booking_id
       and auth.uid() is not null
       and b.user_id = auth.uid()
       and (b.status = 'PICKUP'
            or (b.status = 'CONFIRMED'
                and b.pickup_date <= (now() at time zone 'Asia/Kuala_Lumpur')::date
                and b.return_date >= (now() at time zone 'Asia/Kuala_Lumpur')::date))
  );
$$;

revoke all on function public.bubatrent_is_my_current_rental(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. What the customer's page calls
-- ---------------------------------------------------------------------
-- Empty when the booking isn't the caller's or the rental isn't on now.
create or replace function public.bubatrent_my_rental_car_documents(p_booking_id uuid)
returns table (
  id uuid,
  doc_type text,
  valid_from date,
  valid_until date,
  provider text,
  file_paths text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.doc_type, d.valid_from, d.valid_until, d.provider, d.file_paths
    from public.bubatrent_booking_bookings b
    cross join lateral public.bubatrent_car_current_documents(b.car_id) d
   where b.id = p_booking_id
     and public.bubatrent_is_my_current_rental(b.id)
   order by array_position(array['road_tax', 'insurance', 'puspakom'], d.doc_type);
$$;

revoke all on function public.bubatrent_my_rental_car_documents(uuid) from public, anon;
grant execute on function public.bubatrent_my_rental_car_documents(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Opening the files
-- ---------------------------------------------------------------------
-- True for a file of a document that counts today for a car the caller is
-- renting now.
create or replace function public.bubatrent_is_my_rental_car_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(coalesce(p_name, ''), '/', 1) = 'car-documents'
     and exists (
       select 1
         from public.bubatrent_booking_bookings b
         cross join lateral public.bubatrent_car_current_documents(b.car_id) d
        where b.user_id = auth.uid()
          and b.status in ('PICKUP', 'CONFIRMED')
          and public.bubatrent_is_my_current_rental(b.id)
          and p_name = any (d.file_paths)
     );
$$;

revoke all on function public.bubatrent_is_my_rental_car_file(text) from public, anon;
grant execute on function public.bubatrent_is_my_rental_car_file(text) to authenticated;

-- The read policy from 20261030020000, plus the line for renters
drop policy if exists "Owners and admins can read customer documents" on storage.objects;
create policy "Owners and admins can read customer documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'customer-documents'
    and (
      owner_id = (select auth.uid())::text
      or public.bubatrent_is_own_booking_file(name)
      -- The road tax, insurance and Puspakom of the car the customer is renting now
      or public.bubatrent_is_my_rental_car_file(name)
      or (public.bubatrent_is_admin()
          and (not public.bubatrent_is_fleet_file(name)
               or public.bubatrent_can_access_fleet(public.bubatrent_file_fleet(name))
               -- A car's document files, for the fleet the car is in now
               or public.bubatrent_can_access_fleet(public.bubatrent_car_document_car_fleet(name))))
    )
  );

commit;
