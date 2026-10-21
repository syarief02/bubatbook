-- =====================================================================
-- Booking records: chat proof, refund proofs and other files (2026-10-21)
--
-- Rentals arranged on WhatsApp before the website have no agreement signed
-- on the site. Their proof is the chat (dates, price, customer), and
-- deposits were refunded by transfer. The owner wants those files kept on
-- the booking, so the history of each car and customer is in one place.
--
--   * A booking can have any number of records: chat proof, agreement
--     (paper or chat), payment receipt, deposit refund, photo, other.
--   * Admins of the booking's fleet can see, add and remove them.
--     Customers don't see them.
--   * Files go in the customer-documents bucket under
--     booking-records/<booking id>/.
--
-- Deploy order: run before the frontend ships. Nothing existing changes.
-- =====================================================================

begin;

create table if not exists public.bubatrent_booking_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bubatrent_booking_bookings(id) on delete cascade,
  kind text not null check (kind in ('chat_proof', 'agreement', 'payment_receipt', 'refund', 'photo', 'other')),
  file_path text not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint bubatrent_booking_record_path check (file_path like 'booking-records/' || booking_id::text || '/%')
);
create index if not exists bubatrent_booking_records_booking_idx
  on public.bubatrent_booking_records (booking_id, created_at);

alter table public.bubatrent_booking_records enable row level security;
revoke all on public.bubatrent_booking_records from anon;
revoke update, truncate on public.bubatrent_booking_records from authenticated;
grant select, insert, delete on public.bubatrent_booking_records to authenticated;

drop policy if exists "Fleet admins see booking records" on public.bubatrent_booking_records;
create policy "Fleet admins see booking records"
  on public.bubatrent_booking_records for select to authenticated
  using (public.bubatrent_is_admin() and public.bubatrent_can_access_booking(booking_id));

drop policy if exists "Fleet admins add booking records" on public.bubatrent_booking_records;
create policy "Fleet admins add booking records"
  on public.bubatrent_booking_records for insert to authenticated
  with check (
    public.bubatrent_is_admin()
    and public.bubatrent_can_access_booking(booking_id)
    and created_by = (select auth.uid())
  );

drop policy if exists "Fleet admins remove booking records" on public.bubatrent_booking_records;
create policy "Fleet admins remove booking records"
  on public.bubatrent_booking_records for delete to authenticated
  using (public.bubatrent_is_admin() and public.bubatrent_can_access_booking(booking_id));

-- Adding and removing records shows in the booking's audit log
create or replace function public.bubatrent_audit_booking_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.bubatrent_booking_records := coalesce(new, old);
begin
  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (auth.uid(), case when tg_op = 'INSERT' then 'RECORD_ADDED' else 'RECORD_REMOVED' end,
          'booking', v_row.booking_id,
          jsonb_build_object('record_id', v_row.id, 'kind', v_row.kind, 'note', v_row.note,
                             'file_path', v_row.file_path));
  return null;
end;
$$;

revoke all on function public.bubatrent_audit_booking_record() from public, anon, authenticated;

drop trigger if exists bubatrent_audit_booking_record on public.bubatrent_booking_records;
create trigger bubatrent_audit_booking_record
  after insert or delete on public.bubatrent_booking_records
  for each row execute function public.bubatrent_audit_booking_record();

commit;
