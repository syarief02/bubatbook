-- =====================================================================
-- A WhatsApp contact for each car (2026-10-22)
--
-- Every car's WhatsApp buttons went to the fleet's one number. Other
-- admins (Amira, Iqbal) will add their own vehicles, and customers should
-- reach whoever looks after the car. Now (decided with the owner):
--   * Each admin saves their own WhatsApp number (Fleet Settings). It is
--     kept in bubatrent_booking_admin_contacts, and only they can change
--     it, through bubatrent_admin_set_my_whatsapp.
--   * Each car has a WhatsApp contact (contact_admin_id): an admin or
--     staff member of the car's fleet. A car added by a fleet member is
--     theirs unless they pick someone else.
--   * Customers looking at or booking a car WhatsApp its contact
--     (bubatrent_car_contact). With no contact, or a contact with no
--     number or no longer in the fleet, they get the fleet's number.
--   * Every existing car goes to the owner, with his number.
--
-- Deploy order: run before the frontend ships. The old frontend keeps
-- working: it reads the fleet's number, which doesn't change.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Each admin's own WhatsApp number
-- ---------------------------------------------------------------------
create table if not exists public.bubatrent_booking_admin_contacts (
  user_id uuid primary key references public.bubatrent_booking_profiles(id) on delete cascade,
  -- Digits only, with the country code: 60123456789
  whatsapp text not null check (whatsapp ~ '^[1-9][0-9]{9,14}$'),
  updated_at timestamptz not null default now()
);

alter table public.bubatrent_booking_admin_contacts enable row level security;
revoke all on public.bubatrent_booking_admin_contacts from anon;
revoke insert, update, delete, truncate on public.bubatrent_booking_admin_contacts from authenticated;
grant select on public.bubatrent_booking_admin_contacts to authenticated;

drop policy if exists "Admins see admin contacts" on public.bubatrent_booking_admin_contacts;
create policy "Admins see admin contacts"
  on public.bubatrent_booking_admin_contacts for select to authenticated
  using (user_id = (select auth.uid()) or public.bubatrent_is_admin());

-- Saves the caller's number; an empty one clears it. Returns what was saved.
create or replace function public.bubatrent_admin_set_my_whatsapp(p_whatsapp text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_old text;
begin
  if not public.bubatrent_is_admin() then
    raise exception 'Not authorized: admin role required' using errcode = '42501';
  end if;
  -- A Malaysian number typed the local way: 019-496 1568 -> 60194961568
  if v_number like '0%' then
    v_number := '6' || v_number;
  end if;
  if v_number <> '' and v_number !~ '^[1-9][0-9]{9,14}$' then
    raise exception 'Enter the WhatsApp number with the country code, e.g. 60123456789.'
      using errcode = '22023';
  end if;

  select c.whatsapp into v_old
    from public.bubatrent_booking_admin_contacts c where c.user_id = auth.uid();

  if v_number = '' then
    delete from public.bubatrent_booking_admin_contacts where user_id = auth.uid();
  else
    insert into public.bubatrent_booking_admin_contacts (user_id, whatsapp)
    values (auth.uid(), v_number)
    on conflict (user_id) do update set whatsapp = excluded.whatsapp, updated_at = now();
  end if;

  if v_old is distinct from nullif(v_number, '') then
    insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
    values (auth.uid(), 'WHATSAPP_NUMBER_SET', 'profile', auth.uid(),
      jsonb_build_object('from', v_old, 'to', nullif(v_number, '')));
  end if;

  return nullif(v_number, '');
end;
$$;

revoke all on function public.bubatrent_admin_set_my_whatsapp(text) from public, anon;
grant execute on function public.bubatrent_admin_set_my_whatsapp(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. The car's contact
-- ---------------------------------------------------------------------
alter table public.bubatrent_booking_cars
  add column if not exists contact_admin_id uuid
    references public.bubatrent_booking_profiles(id) on delete set null;

-- Security definer: fleet staff can't read other members' memberships.
create or replace function public.bubatrent_check_car_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A car added by one of the fleet's members is theirs to answer
  if tg_op = 'INSERT' and new.contact_admin_id is null and auth.uid() is not null
     and exists (select 1 from public.bubatrent_booking_fleet_memberships m
                  where m.user_id = auth.uid() and m.fleet_group_id = new.fleet_group_id) then
    new.contact_admin_id := auth.uid();
  end if;

  -- Checked only when the contact or the fleet changes, so a car whose
  -- contact has left the fleet can still be edited
  if new.contact_admin_id is not null
     and (tg_op = 'INSERT'
          or new.contact_admin_id is distinct from old.contact_admin_id
          or new.fleet_group_id is distinct from old.fleet_group_id)
     and not exists (select 1 from public.bubatrent_booking_fleet_memberships m
                      where m.user_id = new.contact_admin_id
                        and m.fleet_group_id = new.fleet_group_id) then
    raise exception 'The WhatsApp contact must be an admin or staff member of this car''s fleet.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists bubatrent_check_car_contact on public.bubatrent_booking_cars;
create trigger bubatrent_check_car_contact
  before insert or update on public.bubatrent_booking_cars
  for each row execute function public.bubatrent_check_car_contact();

-- Who a customer WhatsApps about a car: {"name": ..., "whatsapp": ...},
-- or null when neither the contact nor the fleet has a number. Shows only
-- the contact's display name and the number they chose to publish.
create or replace function public.bubatrent_car_contact(p_car_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('name', coalesce(nullif(trim(p.display_name), ''), g.name),
                               'whatsapp', ac.whatsapp)
       from public.bubatrent_booking_cars c
       join public.bubatrent_booking_fleet_memberships m
         on m.user_id = c.contact_admin_id and m.fleet_group_id = c.fleet_group_id
       join public.bubatrent_booking_admin_contacts ac on ac.user_id = c.contact_admin_id
       join public.bubatrent_booking_profiles p on p.id = c.contact_admin_id
       join public.bubatrent_booking_fleet_groups g on g.id = c.fleet_group_id
      where c.id = p_car_id),
    (select jsonb_build_object('name', g.name,
                               'whatsapp', regexp_replace(g.support_whatsapp, '\D', '', 'g'))
       from public.bubatrent_booking_cars c
       join public.bubatrent_booking_fleet_groups g on g.id = c.fleet_group_id
      where c.id = p_car_id
        and regexp_replace(coalesce(g.support_whatsapp, ''), '\D', '', 'g') <> '')
  );
$$;

revoke all on function public.bubatrent_car_contact(uuid) from public;
grant execute on function public.bubatrent_car_contact(uuid) to anon, authenticated;

-- The fleet's members and their numbers, for choosing a car's contact.
-- Empty for anyone who isn't an admin of the fleet.
create or replace function public.bubatrent_fleet_contacts(p_fleet_group_id uuid)
returns table (user_id uuid, display_name text, fleet_role text, whatsapp text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id,
         coalesce(nullif(trim(p.display_name), ''), p.username),
         m.role,
         ac.whatsapp
    from public.bubatrent_booking_fleet_memberships m
    join public.bubatrent_booking_profiles p on p.id = m.user_id
    left join public.bubatrent_booking_admin_contacts ac on ac.user_id = m.user_id
   where m.fleet_group_id = p_fleet_group_id
     and public.bubatrent_is_admin()
     and public.bubatrent_can_access_fleet(p_fleet_group_id)
   order by 2;
$$;

revoke all on function public.bubatrent_fleet_contacts(uuid) from public, anon;
grant execute on function public.bubatrent_fleet_contacts(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Existing cars: the owner (the super admin in each fleet), with the
--    fleet's number, which is his
-- ---------------------------------------------------------------------
insert into public.bubatrent_booking_admin_contacts (user_id, whatsapp)
select distinct on (p.id) p.id, regexp_replace(g.support_whatsapp, '\D', '', 'g')
  from public.bubatrent_booking_fleet_memberships m
  join public.bubatrent_booking_profiles p on p.id = m.user_id and p.role = 'super_admin'
  join public.bubatrent_booking_fleet_groups g on g.id = m.fleet_group_id
 where regexp_replace(coalesce(g.support_whatsapp, ''), '\D', '', 'g') ~ '^[1-9][0-9]{9,14}$'
 order by p.id, m.created_at
on conflict (user_id) do nothing;

update public.bubatrent_booking_cars c
   set contact_admin_id = m.user_id
  from public.bubatrent_booking_fleet_memberships m
  join public.bubatrent_booking_profiles p on p.id = m.user_id and p.role = 'super_admin'
 where m.fleet_group_id = c.fleet_group_id
   and c.contact_admin_id is null;

commit;
