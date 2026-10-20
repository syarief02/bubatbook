-- =====================================================================
-- Car documents: road tax, insurance, Puspakom, GPS (2026-10-21)
--
-- The owner tracked these in a spreadsheet, and vans were found on the
-- road weeks after their road tax and Puspakom had expired. Now (decided
-- with the owner):
--   * Each renewal is recorded on the car with the date it is valid until
--     and the receipt or certificate, which is required. Optional: the
--     start date, the cost, the insurer or agent, and the receipt or
--     policy number.
--   * Every renewal is kept, so the car has a history. The newest expiry
--     date of each type is the one that counts.
--   * The admin dashboard lists documents that have expired or expire
--     within 30 days (worked out in the browser from this table).
--   * A renewal entered by mistake can be removed, with a reason. The
--     audit log keeps what it said.
--   * A car with documents on record can't be deleted, the same as a car
--     with bookings, so the records stay.
--
-- Files go in the customer-documents bucket under car-documents/<id>/.
--
-- Deploy order: run before the frontend ships. Nothing existing changes.
-- =====================================================================

begin;

create table if not exists public.bubatrent_booking_car_documents (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.bubatrent_booking_cars(id) on delete restrict,
  fleet_group_id uuid not null references public.bubatrent_booking_fleet_groups(id),
  doc_type text not null check (doc_type in ('road_tax', 'insurance', 'puspakom', 'gps')),
  valid_from date,
  valid_until date not null,
  amount numeric(10,2) check (amount >= 0),
  provider text,
  reference text,
  file_paths text[] not null check (cardinality(file_paths) > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint bubatrent_car_document_dates check (valid_from is null or valid_from <= valid_until)
);
create index if not exists bubatrent_booking_car_documents_car_idx
  on public.bubatrent_booking_car_documents (car_id, doc_type, valid_until desc);
create index if not exists bubatrent_booking_car_documents_fleet_idx
  on public.bubatrent_booking_car_documents (fleet_group_id);

alter table public.bubatrent_booking_car_documents enable row level security;
revoke all on public.bubatrent_booking_car_documents from anon;
revoke insert, update, delete, truncate on public.bubatrent_booking_car_documents from authenticated;
grant select on public.bubatrent_booking_car_documents to authenticated;

drop policy if exists "Fleet admins see car documents" on public.bubatrent_booking_car_documents;
create policy "Fleet admins see car documents"
  on public.bubatrent_booking_car_documents for select to authenticated
  using (public.bubatrent_is_admin() and public.bubatrent_can_access_fleet(fleet_group_id));

-- ---------------------------------------------------------------------
-- 1. Record a renewal
-- ---------------------------------------------------------------------
-- The files are uploaded first, to car-documents/<p_id>/.
create or replace function public.bubatrent_admin_add_car_document(
  p_id uuid,
  p_car_id uuid,
  p_doc_type text,
  p_valid_from date,
  p_valid_until date,
  p_amount numeric,
  p_provider text,
  p_reference text,
  p_file_paths text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_car public.bubatrent_booking_cars;
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_amount numeric := round(p_amount, 2);
  v_paths text[];
begin
  if not public.bubatrent_is_admin() then
    raise exception 'Not authorized: admin role required' using errcode = '42501';
  end if;
  select * into v_car from public.bubatrent_booking_cars where id = p_car_id;
  if not found or not public.bubatrent_can_access_fleet(v_car.fleet_group_id) then
    raise exception 'Car not found.' using errcode = 'P0002';
  end if;
  if p_doc_type is null or p_doc_type not in ('road_tax', 'insurance', 'puspakom', 'gps') then
    raise exception 'Choose road tax, insurance, Puspakom or GPS.' using errcode = '22023';
  end if;
  if p_valid_until is null then
    raise exception 'Enter the date it is valid until.' using errcode = '22023';
  end if;
  if p_valid_from is not null and p_valid_from > p_valid_until then
    raise exception 'The start date is after the expiry date.' using errcode = '22023';
  end if;
  -- Catches a mistyped year; none of these run longer than a few years
  if p_valid_until > v_today + interval '5 years' then
    raise exception 'Check the expiry date: it is more than 5 years away.' using errcode = '22023';
  end if;
  if v_amount is not null and v_amount < 0 then
    raise exception 'The cost can''t be negative.' using errcode = '22023';
  end if;
  if v_amount is not null and v_amount > 1000000 then
    raise exception 'That amount is too large.' using errcode = '22023';
  end if;
  if p_id is null
     or exists (select 1 from public.bubatrent_booking_car_documents d where d.id = p_id) then
    raise exception 'This was already recorded. Reload the page.' using errcode = '22023';
  end if;

  select coalesce(array_agg(f.path order by f.n), '{}') into v_paths
    from (select distinct on (trim(x.path)) trim(x.path) as path, x.n
            from unnest(coalesce(p_file_paths, '{}')) with ordinality as x(path, n)
           where nullif(trim(x.path), '') is not null
           order by trim(x.path), x.n) f;
  if cardinality(v_paths) = 0 then
    raise exception 'Add the receipt or certificate (a photo or PDF).' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_paths) p where p not like 'car-documents/' || p_id::text || '/%') then
    raise exception 'Invalid file path.' using errcode = '22023';
  end if;

  insert into public.bubatrent_booking_car_documents (
    id, car_id, fleet_group_id, doc_type, valid_from, valid_until, amount,
    provider, reference, file_paths, created_by
  ) values (
    p_id, p_car_id, v_car.fleet_group_id, p_doc_type, p_valid_from, p_valid_until, v_amount,
    nullif(trim(coalesce(p_provider, '')), ''), nullif(trim(coalesce(p_reference, '')), ''),
    v_paths, auth.uid()
  );

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (auth.uid(), 'CAR_DOCUMENT_ADDED', 'car', p_car_id,
    jsonb_build_object('document_id', p_id, 'plate_number', v_car.plate_number,
                       'doc_type', p_doc_type, 'valid_from', p_valid_from,
                       'valid_until', p_valid_until, 'amount', v_amount));

  return jsonb_build_object('id', p_id, 'valid_until', p_valid_until);
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Remove one entered by mistake
-- ---------------------------------------------------------------------
-- Returns the files, for the page to delete from storage.
create or replace function public.bubatrent_admin_remove_car_document(p_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.bubatrent_booking_car_documents;
  v_plate text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.bubatrent_is_admin() then
    raise exception 'Not authorized: admin role required' using errcode = '42501';
  end if;
  select * into v_doc from public.bubatrent_booking_car_documents where id = p_id for update;
  if not found or not public.bubatrent_can_access_fleet(v_doc.fleet_group_id) then
    raise exception 'Document not found.' using errcode = 'P0002';
  end if;
  if v_reason is null then
    raise exception 'Give a reason for removing it.' using errcode = '22023';
  end if;
  select plate_number into v_plate from public.bubatrent_booking_cars where id = v_doc.car_id;

  delete from public.bubatrent_booking_car_documents where id = p_id;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (auth.uid(), 'CAR_DOCUMENT_REMOVED', 'car', v_doc.car_id,
    jsonb_build_object('document_id', p_id, 'plate_number', v_plate,
                       'doc_type', v_doc.doc_type, 'valid_from', v_doc.valid_from,
                       'valid_until', v_doc.valid_until, 'amount', v_doc.amount,
                       'provider', v_doc.provider, 'reference', v_doc.reference,
                       'recorded_by', v_doc.created_by, 'recorded_at', v_doc.created_at,
                       'reason', v_reason));

  return jsonb_build_object('removed', p_id, 'files', to_jsonb(v_doc.file_paths));
end;
$$;

revoke all on function public.bubatrent_admin_add_car_document(uuid, uuid, text, date, date, numeric, text, text, text[]) from public, anon;
revoke all on function public.bubatrent_admin_remove_car_document(uuid, text) from public, anon;
grant execute on function public.bubatrent_admin_add_car_document(uuid, uuid, text, date, date, numeric, text, text, text[]) to authenticated;
grant execute on function public.bubatrent_admin_remove_car_document(uuid, text) to authenticated;

commit;
