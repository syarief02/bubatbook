-- =====================================================================
-- Shared car documents: leave out the reference (2026-10-30)
--
-- bubatrent_admin_shared_car_documents (20261030000000) also gave the new
-- fleet each document's reference. For the documents imported from the
-- Telegram records, that field holds notes with what the old fleet paid
-- (e.g. "RM480 with runner"), so it is left out: the new fleet sees the
-- type, the dates and who issued it.
--
-- Deploy order: run before the frontend ships.
-- =====================================================================

begin;

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
  fleet_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.car_id, d.doc_type, d.valid_from, d.valid_until, d.provider,
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

commit;
