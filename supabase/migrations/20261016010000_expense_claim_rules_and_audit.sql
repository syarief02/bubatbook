-- =====================================================================
-- Expense claims: checked by the database, locked once paid, and in the
-- audit log (2026-10-16)
--
-- Found by a live test of Expenses: a claim could be saved without an
-- amount (it then counted as RM0), with a negative amount or a future
-- date; a paid claim could be changed back to pending or edited; and
-- nothing recorded who submitted, paid, changed or deleted a claim.
--
-- Now, for requests from the website:
--   * A claim needs a description, an amount above RM0 and a date that is
--     not in the future; its car must belong to the claim's fleet.
--   * New claims start pending, and submitted_by is the signed-in admin.
--   * Marking a claim paid needs the payment receipt (in the claim's own
--     folder); completed_by and completed_at are set by the database.
--   * A paid claim can't be changed. It can still be deleted (and
--     resubmitted), which is logged.
--   * Every submit, payment, change and deletion is written to the audit
--     log (resource_type 'expense').
-- The service role (maintenance) is not restricted.
--
-- Deploy order: run before the frontend ships. The old Expenses page keeps
-- working, except that a claim without an amount is now refused with a
-- message.
-- =====================================================================

begin;

alter table public.bubatrent_booking_expense_claims
  drop constraint if exists bubatrent_expense_amount_positive;
alter table public.bubatrent_booking_expense_claims
  add constraint bubatrent_expense_amount_positive check (total_amount > 0);

create or replace function public.bubatrent_check_expense_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- This function runs as its owner, so current_user can't tell a website
  -- request apart; the role setting still holds the request's role.
  v_from_site boolean := coalesce(current_setting('role', true), '') in ('anon', 'authenticated');
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  if not v_from_site then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'completed' then
    raise exception 'This claim is already paid and can''t be changed. Delete it and submit it again if it is wrong.'
      using errcode = '22023';
  end if;

  if new.total_amount is null or new.total_amount <= 0 then
    raise exception 'Enter the amount of the claim.' using errcode = '22023';
  end if;
  if new.total_amount > 1000000 then
    raise exception 'That amount is too large.' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(new.description, '')), '') is null then
    raise exception 'Describe the expense.' using errcode = '22023';
  end if;
  if new.expense_date is null then
    raise exception 'Enter the date of the expense.' using errcode = '22023';
  end if;
  if new.expense_date > v_today then
    raise exception 'The expense date can''t be in the future.' using errcode = '22023';
  end if;
  if new.car_id is not null and not exists (
    select 1 from public.bubatrent_booking_cars c
     where c.id = new.car_id and c.fleet_group_id is not distinct from new.fleet_group_id
  ) then
    raise exception 'That car is not in this fleet.' using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    new.submitted_by := auth.uid();
    new.status := 'pending';
    new.payment_receipt_path := null;
    new.completed_by := null;
    new.completed_at := null;
  elsif new.status = 'completed' then
    if new.payment_receipt_path is null
       or new.payment_receipt_path not like 'expenses/' || new.id::text || '/%' then
      raise exception 'Upload the payment receipt first.' using errcode = '22023';
    end if;
    new.completed_by := auth.uid();
    new.completed_at := now();
  else
    new.submitted_by := old.submitted_by;
    new.payment_receipt_path := null;
    new.completed_by := null;
    new.completed_at := null;
  end if;

  return new;
end;
$$;

revoke all on function public.bubatrent_check_expense_claim() from public, anon, authenticated;

drop trigger if exists bubatrent_check_expense_claim on public.bubatrent_booking_expense_claims;
create trigger bubatrent_check_expense_claim
  before insert or update on public.bubatrent_booking_expense_claims
  for each row execute function public.bubatrent_check_expense_claim();

create or replace function public.bubatrent_audit_expense_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.bubatrent_booking_expense_claims;
  v_action text;
begin
  if tg_op = 'DELETE' then
    v_row := old;
    v_action := 'EXPENSE_DELETED';
  elsif tg_op = 'INSERT' then
    v_row := new;
    v_action := 'EXPENSE_SUBMITTED';
  else
    v_row := new;
    v_action := case when new.status = 'completed' and old.status is distinct from 'completed'
                     then 'EXPENSE_PAID' else 'EXPENSE_CHANGED' end;
  end if;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (
    auth.uid(), v_action, 'expense', v_row.id,
    jsonb_build_object(
      'by', case when auth.uid() is null then 'system'
                 when public.bubatrent_is_admin() then 'admin' else 'customer' end,
      'amount', v_row.total_amount,
      'description', v_row.description,
      'car_id', v_row.car_id,
      'expense_date', v_row.expense_date,
      'status', v_row.status,
      'fleet_group_id', v_row.fleet_group_id)
    || case when v_action = 'EXPENSE_CHANGED' then jsonb_build_object(
         'before', jsonb_build_object(
           'amount', old.total_amount, 'description', old.description,
           'car_id', old.car_id, 'expense_date', old.expense_date, 'status', old.status))
       else '{}'::jsonb end
  );

  return null;
end;
$$;

revoke all on function public.bubatrent_audit_expense_claim() from public, anon, authenticated;

drop trigger if exists bubatrent_audit_expense_claim on public.bubatrent_booking_expense_claims;
create trigger bubatrent_audit_expense_claim
  after insert or update or delete on public.bubatrent_booking_expense_claims
  for each row execute function public.bubatrent_audit_expense_claim();

commit;
