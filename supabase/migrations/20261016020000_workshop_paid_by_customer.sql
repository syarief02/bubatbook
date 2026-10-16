-- =====================================================================
-- Repairs the customer paid the workshop for directly (2026-10-16)
--
-- Sometimes a customer pays the workshop for a repair that is ours to pay
-- and takes it off what they owe us (a contra). Until now staff could only
-- lower the price or file the bill as an ordinary expense claim, so the
-- rental, the repair cost and the customer's invoice did not agree.
--
-- Now (decided with the owner):
--   * Staff record it on the booking with
--     bubatrent_admin_record_workshop_payment: the workshop, what was
--     repaired, the amount, the date the customer paid and the workshop's
--     bill or receipt.
--   * The repair becomes a paid expense claim for the booking's car, so it
--     shows in Expenses and Sales like any repair. It can't be deleted
--     from Expenses; it is removed from the booking.
--   * The amount counts as the customer paying us, in this order: the
--     rental still to pay, then charges owed, then the rest goes to their
--     credit balance. The rental is still income in full.
--   * If it covers the rest of the rental, the full payment is verified.
--   * Verifying the full payment (bubatrent_admin_verify_full_payment, used
--     by the booking page from now on) records only what was left to pay.
--   * One entered by mistake can be removed with a reason
--     (bubatrent_admin_remove_workshop_payment), unless the rest of the
--     rental was recorded as paid since, or the customer already used the
--     credit it gave them.
--   * Customers see these on their booking and invoice.
--
-- Deploy order: run before the frontend ships. The old booking page keeps
-- working.
-- =====================================================================

begin;

create table if not exists public.bubatrent_booking_workshop_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bubatrent_booking_bookings(id) on delete cascade,
  -- The repair as a paid expense of the car
  claim_id uuid references public.bubatrent_booking_expense_claims(id) on delete set null,
  workshop text not null,
  description text not null,
  paid_on date not null,
  amount numeric(10,2) not null check (amount > 0),
  -- Where the amount went: the rental still to pay, charges owed, credit
  to_rent numeric(10,2) not null default 0 check (to_rent >= 0),
  to_charges numeric(10,2) not null default 0 check (to_charges >= 0),
  to_credit numeric(10,2) not null default 0 check (to_credit >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint bubatrent_workshop_payment_split check (to_rent + to_charges + to_credit = amount)
);
create index if not exists bubatrent_booking_workshop_payments_booking_idx
  on public.bubatrent_booking_workshop_payments (booking_id);
create index if not exists bubatrent_booking_workshop_payments_claim_idx
  on public.bubatrent_booking_workshop_payments (claim_id);

alter table public.bubatrent_booking_workshop_payments enable row level security;
revoke all on public.bubatrent_booking_workshop_payments from anon;
revoke insert, update, delete, truncate on public.bubatrent_booking_workshop_payments from authenticated;
grant select on public.bubatrent_booking_workshop_payments to authenticated;

-- The customer of the booking, and admins of its fleet
drop policy if exists "Booking owner and fleet admins see workshop payments"
  on public.bubatrent_booking_workshop_payments;
create policy "Booking owner and fleet admins see workshop payments"
  on public.bubatrent_booking_workshop_payments for select to authenticated
  using (public.bubatrent_can_access_booking(booking_id));

-- ---------------------------------------------------------------------
-- 1. The rental still to pay, after workshop payments
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_booking_rent_due(p_booking public.bubatrent_booking_bookings)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_booking.full_payment_status = 'verified' then 0
    else greatest(coalesce(p_booking.full_payment_amount, p_booking.total_price)
                  - coalesce((select sum(w.to_rent)
                                from public.bubatrent_booking_workshop_payments w
                               where w.booking_id = p_booking.id), 0), 0) end;
$$;

revoke all on function public.bubatrent_booking_rent_due(public.bubatrent_booking_bookings)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Record a workshop payment
-- ---------------------------------------------------------------------
-- The files are uploaded first, to expenses/<p_claim_id>/; the first one
-- is kept as the proof of payment.
create or replace function public.bubatrent_admin_record_workshop_payment(
  p_booking_id uuid,
  p_claim_id uuid,
  p_workshop text,
  p_description text,
  p_paid_on date,
  p_amount numeric,
  p_file_paths text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings := public.bubatrent_admin_lock_booking(p_booking_id);
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_workshop text := nullif(trim(coalesce(p_workshop, '')), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_paths text[];
  v_rent_due numeric := public.bubatrent_booking_rent_due(v_booking);
  v_to_rent numeric;
  v_to_charges numeric;
  v_to_credit numeric;
begin
  if v_booking.status not in ('CONFIRMED', 'PICKUP', 'RETURNED') then
    raise exception 'This can be recorded once the booking is confirmed.' using errcode = '22023';
  end if;
  if v_workshop is null then
    raise exception 'Enter the workshop''s name.' using errcode = '22023';
  end if;
  if v_description is null then
    raise exception 'Describe the repair.' using errcode = '22023';
  end if;
  if p_paid_on is null then
    raise exception 'Enter the date the customer paid the workshop.' using errcode = '22023';
  end if;
  if p_paid_on > v_today then
    raise exception 'The date paid can''t be in the future.' using errcode = '22023';
  end if;
  if v_amount <= 0 then
    raise exception 'Enter the amount the customer paid the workshop.' using errcode = '22023';
  end if;
  if v_amount > 1000000 then
    raise exception 'That amount is too large.' using errcode = '22023';
  end if;
  if p_claim_id is null
     or exists (select 1 from public.bubatrent_booking_expense_claims c where c.id = p_claim_id) then
    raise exception 'This was already recorded. Reload the page.' using errcode = '22023';
  end if;

  select coalesce(array_agg(f.path order by f.n), '{}') into v_paths
    from (select distinct on (trim(x.path)) trim(x.path) as path, x.n
            from unnest(coalesce(p_file_paths, '{}')) with ordinality as x(path, n)
           where nullif(trim(x.path), '') is not null
           order by trim(x.path), x.n) f;
  if cardinality(v_paths) = 0 then
    raise exception 'Add a photo of the workshop''s bill or receipt.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_paths) p where p not like 'expenses/' || p_claim_id::text || '/%') then
    raise exception 'Invalid file path.' using errcode = '22023';
  end if;

  -- What the customer owes us on this booking, in order
  v_to_rent := least(v_amount, v_rent_due);
  v_to_charges := least(v_amount - v_to_rent, v_booking.amount_owed);
  v_to_credit := v_amount - v_to_rent - v_to_charges;
  if v_to_credit > 0 and v_booking.user_id is null then
    raise exception 'This booking has no customer account, so the RM% left over can''t go to their credit.',
      to_char(v_to_credit, 'FM999999990.00') using errcode = '22023';
  end if;

  -- The repair: an expense of the car, paid (by the customer). The expense
  -- rules apply as for any claim: added as pending, then paid with proof.
  insert into public.bubatrent_booking_expense_claims (
    id, car_id, fleet_group_id, expense_date, description, total_amount
  ) values (
    p_claim_id, v_booking.car_id, v_booking.fleet_group_id, p_paid_on,
    v_workshop || ': ' || v_description || ' (paid by '
      || coalesce(nullif(trim(v_booking.customer_name), ''), 'the customer')
      || ' directly to the workshop, offset on booking INV-'
      || upper(left(v_booking.id::text, 8)) || ')',
    v_amount
  );
  insert into public.bubatrent_booking_expense_images (claim_id, file_path)
  select p_claim_id, p from unnest(v_paths) p;
  update public.bubatrent_booking_expense_claims
     set status = 'completed', payment_receipt_path = v_paths[1]
   where id = p_claim_id;

  insert into public.bubatrent_booking_workshop_payments (
    booking_id, claim_id, workshop, description, paid_on, amount,
    to_rent, to_charges, to_credit, created_by
  ) values (
    p_booking_id, p_claim_id, v_workshop, v_description, p_paid_on, v_amount,
    v_to_rent, v_to_charges, v_to_credit, auth.uid()
  );

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (auth.uid(), 'WORKSHOP_PAYMENT', 'booking', p_booking_id,
    jsonb_build_object('amount', v_amount, 'workshop', v_workshop, 'description', v_description,
                       'paid_on', p_paid_on, 'to_rent', v_to_rent, 'to_charges', v_to_charges,
                       'to_credit', v_to_credit, 'claim_id', p_claim_id, 'by', 'admin'));

  -- It covers the rest of the rental: the full payment is complete
  if v_to_rent > 0 and v_to_rent = v_rent_due then
    update public.bubatrent_booking_bookings
       set full_payment_status = 'verified'
     where id = p_booking_id;
  end if;
  if v_to_charges > 0 then
    update public.bubatrent_booking_bookings
       set amount_owed = amount_owed - v_to_charges
     where id = p_booking_id;
  end if;
  if v_to_credit > 0 then
    update public.bubatrent_booking_profiles
       set deposit_credit = coalesce(deposit_credit, 0) + v_to_credit
     where id = v_booking.user_id;
    insert into public.bubatrent_booking_credit_transactions (
      user_id, booking_id, amount, type, description, admin_id, fleet_group_id
    ) values (
      v_booking.user_id, p_booking_id, v_to_credit, 'added',
      'Paid to ' || v_workshop || ' for us: ' || v_description,
      auth.uid(), v_booking.fleet_group_id
    );
  end if;

  return jsonb_build_object(
    'to_rent', v_to_rent, 'to_charges', v_to_charges, 'to_credit', v_to_credit,
    'rent_still_due', v_rent_due - v_to_rent,
    'rent_verified', v_to_rent > 0 and v_to_rent = v_rent_due);
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Remove one entered by mistake
-- ---------------------------------------------------------------------
-- Returns the expense files, for the page to delete from storage.
create or replace function public.bubatrent_admin_remove_workshop_payment(p_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.bubatrent_booking_workshop_payments;
  v_booking public.bubatrent_booking_bookings;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_balance numeric;
  v_files text[];
begin
  select * into v_payment from public.bubatrent_booking_workshop_payments where id = p_id;
  if not found then
    raise exception 'Workshop payment not found.' using errcode = 'P0002';
  end if;
  v_booking := public.bubatrent_admin_lock_booking(v_payment.booking_id);
  if v_reason is null then
    raise exception 'Give a reason for removing it.' using errcode = '22023';
  end if;

  if v_payment.to_rent > 0 and v_booking.full_payment_status = 'verified' and exists (
    select 1 from public.bubatrent_booking_payments p
     where p.booking_id = v_booking.id and p.payment_type = 'full_payment' and p.status = 'completed'
  ) then
    raise exception 'The rest of the rental was recorded as paid after this, so it can''t be removed. Correct the customer''s balance with Add or Deduct Credit instead.'
      using errcode = '22023';
  end if;

  if v_payment.to_credit > 0 then
    select coalesce(deposit_credit, 0) into v_balance
      from public.bubatrent_booking_profiles
     where id = v_booking.user_id
     for update;
    if v_balance < v_payment.to_credit then
      raise exception 'The customer has already used the RM% credit this gave them, so it can''t be removed.',
        to_char(v_payment.to_credit, 'FM999999990.00') using errcode = '22023';
    end if;
    update public.bubatrent_booking_profiles
       set deposit_credit = v_balance - v_payment.to_credit
     where id = v_booking.user_id;
    insert into public.bubatrent_booking_credit_transactions (
      user_id, booking_id, amount, type, description, admin_id, fleet_group_id
    ) values (
      v_booking.user_id, v_booking.id, -v_payment.to_credit, 'deducted',
      'Workshop payment removed: ' || v_reason, auth.uid(), v_booking.fleet_group_id
    );
  end if;

  if v_payment.to_charges > 0 then
    update public.bubatrent_booking_bookings
       set amount_owed = amount_owed + v_payment.to_charges
     where id = v_booking.id;
  end if;
  -- It was what covered the rest of the rental: that is to pay again
  if v_payment.to_rent > 0 and v_booking.full_payment_status = 'verified' then
    update public.bubatrent_booking_bookings
       set full_payment_status = case when full_payment_receipt_path is null then 'pending'
                                      else 'uploaded' end
     where id = v_booking.id;
  end if;

  select coalesce(array_agg(distinct f), '{}') into v_files
    from public.bubatrent_booking_expense_claims c
    cross join lateral unnest(
      array[c.payment_receipt_path]
      || array(select i.file_path from public.bubatrent_booking_expense_images i where i.claim_id = c.id)
    ) f
   where c.id = v_payment.claim_id and f is not null;

  delete from public.bubatrent_booking_workshop_payments where id = p_id;
  -- The repair expense goes with it (logged as a deleted expense)
  delete from public.bubatrent_booking_expense_claims where id = v_payment.claim_id;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (auth.uid(), 'WORKSHOP_PAYMENT_REMOVED', 'booking', v_booking.id,
    jsonb_build_object('amount', v_payment.amount, 'workshop', v_payment.workshop,
                       'description', v_payment.description, 'to_rent', v_payment.to_rent,
                       'to_charges', v_payment.to_charges, 'to_credit', v_payment.to_credit,
                       'reason', v_reason, 'by', 'admin'));

  return jsonb_build_object('removed', v_payment.amount, 'files', to_jsonb(v_files));
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Verify the full payment: records what was left to pay
-- ---------------------------------------------------------------------
-- Replaces the booking page's two separate writes (mark verified, then
-- add the payment record).
create or replace function public.bubatrent_admin_verify_full_payment(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings := public.bubatrent_admin_lock_booking(p_booking_id);
  v_due numeric := public.bubatrent_booking_rent_due(v_booking);
  v_payment_id uuid;
begin
  if v_booking.full_payment_status = 'verified' then
    return jsonb_build_object('status', 'already_verified');
  end if;

  update public.bubatrent_booking_bookings
     set full_payment_status = 'verified'
   where id = p_booking_id;

  if v_due > 0 then
    select id into v_payment_id
      from public.bubatrent_booking_payments
     where booking_id = p_booking_id and payment_type = 'full_payment'
     order by created_at
     limit 1;
    if v_payment_id is not null then
      update public.bubatrent_booking_payments
         set status = 'completed', amount = v_due
       where id = v_payment_id;
    else
      insert into public.bubatrent_booking_payments (
        booking_id, amount, payment_method, status, simulated, payment_type,
        receipt_path, reference_number, fleet_group_id
      ) values (
        p_booking_id, v_due,
        -- No receipt means the rent was paid in cash at the counter
        case when v_booking.full_payment_receipt_path is null then 'cash' else 'bank_transfer' end,
        'completed', false, 'full_payment', v_booking.full_payment_receipt_path,
        'FP-' || upper(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint)),
        v_booking.fleet_group_id
      );
    end if;
  end if;

  return jsonb_build_object('status', 'verified', 'amount', v_due);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. A repair the customer paid is removed from the booking, not Expenses
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_keep_workshop_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.bubatrent_booking_workshop_payments w where w.claim_id = old.id) then
    raise exception 'The customer paid this repair directly to the workshop. Remove it from their booking instead.'
      using errcode = '22023';
  end if;
  return old;
end;
$$;

revoke all on function public.bubatrent_keep_workshop_claim() from public, anon, authenticated;

drop trigger if exists bubatrent_keep_workshop_claim on public.bubatrent_booking_expense_claims;
create trigger bubatrent_keep_workshop_claim
  before delete on public.bubatrent_booking_expense_claims
  for each row execute function public.bubatrent_keep_workshop_claim();

revoke all on function public.bubatrent_admin_record_workshop_payment(uuid, uuid, text, text, date, numeric, text[]) from public, anon;
revoke all on function public.bubatrent_admin_remove_workshop_payment(uuid, text) from public, anon;
revoke all on function public.bubatrent_admin_verify_full_payment(uuid) from public, anon;
grant execute on function public.bubatrent_admin_record_workshop_payment(uuid, uuid, text, text, date, numeric, text[]) to authenticated;
grant execute on function public.bubatrent_admin_remove_workshop_payment(uuid, text) to authenticated;
grant execute on function public.bubatrent_admin_verify_full_payment(uuid) to authenticated;

commit;
