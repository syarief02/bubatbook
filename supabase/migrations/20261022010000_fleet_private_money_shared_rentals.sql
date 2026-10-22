-- =====================================================================
-- Fleets share customers, not money (2026-10-22)
--
-- A second fleet (Bocah Trading, Iqbal) joined. The owner's rule:
-- customer details and their rental history are shared between the
-- fleets' admins; a fleet's income and expenses are not.
--
-- Profiles, customer documents, bookings, payments and expense claims
-- already followed it, except that a fleet couldn't see a customer's
-- rentals with other fleets. Three things let any admin see another
-- fleet's money, and now don't:
--   * Files: any admin could read, replace or delete every file,
--     including other fleets' payment receipts, expense receipts, car
--     documents and booking records. Those folders are now for the
--     fleet the file belongs to (and the person who uploaded it).
--     Customers' own files (IC, licence, credit receipts) stay shared.
--   * The audit log: any admin could read every entry, with payment,
--     price and expense amounts. An entry is now for the fleet of the
--     booking, car, expense or fleet it is about. Entries about a
--     customer stay shared, and you always see what you did yourself.
--   * Upload logs: any admin could read and delete all of them. Now by
--     the booking's fleet.
-- And it adds what was missing:
--   * bubatrent_admin_other_fleet_rentals: a customer's rentals with
--     other fleets, without amounts or payment (dates, car, status, and
--     which charges there were, e.g. late return or damage), for
--     Customer History. Not whether rent is unpaid: some imported
--     rentals have no payment on record yet, and would be flagged wrongly.
--
-- Super admins still see everything.
--
-- Deploy order: run before the frontend ships. The old frontend keeps
-- working; Customer History just doesn't show the other fleets yet.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Which fleet a file, an audit entry or an upload log belongs to
-- ---------------------------------------------------------------------
-- Folders that hold a fleet's money and paperwork (see the upload paths
-- in Checkout, MyBookings, BookingDetail, AdminBookForCustomer,
-- ReturnCharges, Expenses, WorkshopPayments, CarDocuments, BookingRecords).
create or replace function public.bubatrent_is_fleet_file(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select split_part(coalesce(p_name, ''), '/', 1)
         in ('receipts', 'expenses', 'car-documents', 'booking-records');
$$;

-- The fleet a file in one of those folders belongs to; null if unknown
-- (e.g. just uploaded and not saved yet: its uploader can still see it).
create or replace function public.bubatrent_file_fleet(p_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with f as (
    select split_part(p_name, '/', 1) as folder,
           case when split_part(p_name, '/', 2)
                     ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then split_part(p_name, '/', 2)::uuid end as id
  )
  select case
    when f.folder in ('receipts', 'booking-records') and f.id is not null then
      (select b.fleet_group_id from public.bubatrent_booking_bookings b where b.id = f.id)
    when f.folder = 'expenses' and f.id is not null then
      (select e.fleet_group_id from public.bubatrent_booking_expense_claims e where e.id = f.id)
    when f.folder = 'car-documents' and f.id is not null then
      (select d.fleet_group_id from public.bubatrent_booking_car_documents d where d.id = f.id)
    -- Counter-booking receipts (receipts/admin_<time>.jpg): the booking or payment using it
    when f.folder = 'receipts' then coalesce(
      (select b.fleet_group_id from public.bubatrent_booking_bookings b
        where p_name in (b.deposit_receipt_path, b.full_payment_receipt_path) limit 1),
      (select b.fleet_group_id from public.bubatrent_booking_payments p
         join public.bubatrent_booking_bookings b on b.id = p.booking_id
        where p.receipt_path = p_name limit 1))
  end
  from f;
$$;

create or replace function public.bubatrent_booking_fleet(p_booking_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.fleet_group_id from public.bubatrent_booking_bookings b where b.id = p_booking_id;
$$;

-- The fleet an audit entry is about; null for entries about a customer.
create or replace function public.bubatrent_audit_log_fleet(
  p_resource_type text, p_resource_id uuid, p_details jsonb
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with d as (
    select case when jsonb_typeof(p_details) = 'object' then p_details else '{}'::jsonb end as j
  ), ids as (
    select case when d.j->>'car_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then (d.j->>'car_id')::uuid end as car_id,
           case when d.j->>'fleet_group_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then (d.j->>'fleet_group_id')::uuid end as fleet_id
      from d
  )
  select case p_resource_type
    -- A deleted booking keeps its car in the details
    when 'booking' then coalesce(
      (select b.fleet_group_id from public.bubatrent_booking_bookings b where b.id = p_resource_id),
      (select c.fleet_group_id from public.bubatrent_booking_cars c where c.id = ids.car_id))
    when 'expense' then coalesce(
      (select e.fleet_group_id from public.bubatrent_booking_expense_claims e where e.id = p_resource_id),
      ids.fleet_id)
    when 'car' then
      (select c.fleet_group_id from public.bubatrent_booking_cars c where c.id = p_resource_id)
    when 'fleet_group' then p_resource_id
    when 'fleet_membership' then
      (select m.fleet_group_id from public.bubatrent_booking_fleet_memberships m where m.id = p_resource_id)
  end
  from ids;
$$;

revoke all on function public.bubatrent_file_fleet(text) from public, anon;
revoke all on function public.bubatrent_booking_fleet(uuid) from public, anon;
revoke all on function public.bubatrent_audit_log_fleet(text, uuid, jsonb) from public, anon;
grant execute on function public.bubatrent_is_fleet_file(text) to authenticated;
grant execute on function public.bubatrent_file_fleet(text) to authenticated;
grant execute on function public.bubatrent_booking_fleet(uuid) to authenticated;
grant execute on function public.bubatrent_audit_log_fleet(text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Files
-- ---------------------------------------------------------------------
drop policy if exists "Owners and admins can read customer documents" on storage.objects;
create policy "Owners and admins can read customer documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'customer-documents'
    and (
      owner_id = (select auth.uid())::text
      or public.bubatrent_is_own_booking_file(name)
      or (public.bubatrent_is_admin()
          and (not public.bubatrent_is_fleet_file(name)
               or public.bubatrent_can_access_fleet(public.bubatrent_file_fleet(name))))
    )
  );

drop policy if exists "Owners and admins can update customer documents" on storage.objects;
create policy "Owners and admins can update customer documents"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'customer-documents'
    and (
      owner_id = (select auth.uid())::text
      or (public.bubatrent_is_admin()
          and (not public.bubatrent_is_fleet_file(name)
               or public.bubatrent_can_access_fleet(public.bubatrent_file_fleet(name))))
    )
  );

drop policy if exists "Admins can delete customer documents" on storage.objects;
create policy "Admins can delete customer documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'customer-documents'
    and public.bubatrent_is_admin()
    and (not public.bubatrent_is_fleet_file(name)
         or owner_id = (select auth.uid())::text
         or public.bubatrent_can_access_fleet(public.bubatrent_file_fleet(name)))
  );

-- ---------------------------------------------------------------------
-- 3. Audit log and upload logs
-- ---------------------------------------------------------------------
drop policy if exists "Admins can view audit logs" on public.bubatrent_booking_audit_logs;
create policy "Admins can view audit logs"
  on public.bubatrent_booking_audit_logs for select to authenticated
  using (
    public.bubatrent_is_admin()
    and (
      admin_id = (select auth.uid())
      or public.bubatrent_is_super_admin()
      -- Customers are shared between fleets
      or resource_type in ('profile', 'change_request', 'document')
      or public.bubatrent_can_access_fleet(
           public.bubatrent_audit_log_fleet(resource_type, resource_id, details))
    )
  );

drop policy if exists "Admins can read all upload logs" on public.bubatrent_booking_upload_logs;
create policy "Admins can read all upload logs"
  on public.bubatrent_booking_upload_logs for select to authenticated
  using (
    public.bubatrent_is_admin()
    and (booking_id is null
         or public.bubatrent_can_access_fleet(public.bubatrent_booking_fleet(booking_id)))
  );

drop policy if exists "Admins can delete upload logs" on public.bubatrent_booking_upload_logs;
create policy "Admins can delete upload logs"
  on public.bubatrent_booking_upload_logs for delete to authenticated
  using (
    public.bubatrent_is_admin()
    and (booking_id is null
         or public.bubatrent_can_access_fleet(public.bubatrent_booking_fleet(booking_id)))
  );

-- ---------------------------------------------------------------------
-- 4. A customer's rentals with other fleets, without amounts
-- ---------------------------------------------------------------------
-- Rentals outside p_fleet_group_id (the fleet being viewed); with no
-- fleet chosen, rentals in fleets the caller isn't in. The same booked
-- statuses Customer History lists.
create or replace function public.bubatrent_admin_other_fleet_rentals(p_fleet_group_id uuid)
returns table (
  id uuid,
  user_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  fleet_name text,
  car_name text,
  plate_number text,
  pickup_date date,
  return_date date,
  actual_return_date date,
  status text,
  charge_kinds text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.user_id, b.customer_name, b.customer_phone, b.customer_email,
         g.name, c.name, c.plate_number,
         b.pickup_date, b.return_date, b.actual_return_date, b.status,
         array(select distinct ch.kind from public.bubatrent_booking_charges ch
                where ch.booking_id = b.id order by 1)
    from public.bubatrent_booking_bookings b
    join public.bubatrent_booking_fleet_groups g on g.id = b.fleet_group_id
    left join public.bubatrent_booking_cars c on c.id = b.car_id
   where public.bubatrent_is_admin()
     and b.status in ('DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'RETURNED')
     and b.fleet_group_id is distinct from p_fleet_group_id
     and (p_fleet_group_id is not null or not public.bubatrent_can_access_fleet(b.fleet_group_id))
   order by b.pickup_date desc;
$$;

revoke all on function public.bubatrent_admin_other_fleet_rentals(uuid) from public, anon;
grant execute on function public.bubatrent_admin_other_fleet_rentals(uuid) to authenticated;

commit;
