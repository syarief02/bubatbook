-- =====================================================================
-- Shared car documents: the new fleet can open the files (2026-10-30)
--
-- A car's fleet sees the documents another fleet recorded for the car
-- (20261030000000, 20261030010000). The owner: the new fleet should be able
-- to open the files too (the receipt, certificate, cover note or road tax
-- disc), e.g. to show the insurance after an accident. The cost and the
-- reference still aren't shared.
--
--   * bubatrent_admin_shared_car_documents also returns file_paths.
--   * An admin who can access a car's current fleet can read the files of
--     every document recorded for that car (read only; changing or
--     deleting them stays with the fleet that recorded them).
--
-- Deploy order: run before the frontend ships.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. The shared documents with their files
-- ---------------------------------------------------------------------
drop function if exists public.bubatrent_admin_shared_car_documents(uuid);

-- Documents of the cars in p_fleet_group_id (the fleet being viewed)
-- recorded by another fleet; with no fleet chosen, documents of the
-- caller's fleets' cars recorded by fleets the caller isn't in.
create function public.bubatrent_admin_shared_car_documents(p_fleet_group_id uuid)
returns table (
  id uuid,
  car_id uuid,
  doc_type text,
  valid_from date,
  valid_until date,
  provider text,
  file_paths text[],
  fleet_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.car_id, d.doc_type, d.valid_from, d.valid_until, d.provider, d.file_paths,
         g.name, d.created_at
    from public.bubatrent_booking_car_documents d
    join public.bubatrent_booking_cars c on c.id = d.car_id
    join public.bubatrent_booking_fleet_groups g on g.id = d.fleet_group_id
   where public.bubatrent_is_admin()
     and public.bubatrent_can_access_fleet(c.fleet_group_id)
     and (p_fleet_group_id is null or c.fleet_group_id = p_fleet_group_id)
     and d.fleet_group_id is distinct from p_fleet_group_id
     and (p_fleet_group_id is not null or not public.bubatrent_can_access_fleet(d.fleet_group_id))
   order by d.valid_until desc;
$$;

revoke all on function public.bubatrent_admin_shared_car_documents(uuid) from public, anon;
grant execute on function public.bubatrent_admin_shared_car_documents(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Reading the files
-- ---------------------------------------------------------------------
-- The current fleet of the car a car-documents/<document id>/ file is
-- about; null for any other file.
create or replace function public.bubatrent_car_document_car_fleet(p_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.fleet_group_id
    from public.bubatrent_booking_car_documents d
    join public.bubatrent_booking_cars c on c.id = d.car_id
   where split_part(coalesce(p_name, ''), '/', 1) = 'car-documents'
     and split_part(p_name, '/', 2)
         ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and d.id = split_part(p_name, '/', 2)::uuid;
$$;

revoke all on function public.bubatrent_car_document_car_fleet(text) from public, anon;
grant execute on function public.bubatrent_car_document_car_fleet(text) to authenticated;

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
               or public.bubatrent_can_access_fleet(public.bubatrent_file_fleet(name))
               -- A car's document files, for the fleet the car is in now
               or public.bubatrent_can_access_fleet(public.bubatrent_car_document_car_fleet(name))))
    )
  );

commit;
