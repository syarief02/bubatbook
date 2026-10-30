-- =====================================================================
-- A car's fleet sees all its documents' dates (2026-10-30)
--
-- When a car moves to another fleet "starting fresh from a date", its
-- documents from before that date stay with the old fleet (it paid for
-- them). The new fleet then saw the car with no road tax, insurance,
-- Puspakom or GPS at all, and got no expiry alerts, although the car was
-- covered (VEY 3830 and VJC 5290 in Oct 2026). The owner: the new fleet
-- needs to know whether the documents are still valid to rent the car out.
--
-- Now a car's fleet also sees the documents another fleet recorded for the
-- car: the type, the dates, who issued it and the receipt or policy number.
-- The cost and the receipt files stay with the fleet that paid, like a
-- customer's rentals with other fleets (bubatrent_admin_other_fleet_rentals).
--
-- Deploy order: run before the frontend ships. Nothing existing changes.
-- =====================================================================

begin;

-- Documents of the cars in p_fleet_group_id (the fleet being viewed)
-- recorded by another fleet; with no fleet chosen, documents of the
-- caller's fleets' cars recorded by fleets the caller isn't in.
create or replace function public.bubatrent_admin_shared_car_documents(p_fleet_group_id uuid)
returns table (
  id uuid,
  car_id uuid,
  doc_type text,
  valid_from date,
  valid_until date,
  provider text,
  reference text,
  fleet_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.car_id, d.doc_type, d.valid_from, d.valid_until, d.provider, d.reference,
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
