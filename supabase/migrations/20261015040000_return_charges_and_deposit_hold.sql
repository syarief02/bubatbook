-- =====================================================================
-- Charges on return (late return, cleaning, fuel, damage) and holding the
-- deposit while damage is assessed (2026-10-15)
--
-- Until now Mark Returned credited the whole deposit, and staff took
-- charges off later with Deduct Credit: not linked to the booking, refused
-- when larger than the balance, and no way to keep the deposit while a
-- repair is quoted.
--
-- Now (decided with the owner):
--   * Staff return a car with bubatrent_admin_return_booking and list any
--     charges, typing each amount (no automatic late-fee formula). Charges
--     are taken from this booking's deposit; the rest of the deposit goes
--     to the customer's credit. Each charge is a row in
--     bubatrent_booking_charges and a ledger entry, so the customer sees
--     what it was for.
--   * Charges larger than the deposit are recorded as owed
--     (bookings.amount_owed). Staff record the payment when it is collected
--     (bubatrent_admin_record_charge_payment: cash or transfer).
--   * Or staff put the deposit on hold (bookings.deposit_on_hold) and settle
--     it later with bubatrent_admin_settle_deposit, once the cost is known.
--   * Charges found after the deposit was settled can still be added; they
--     are owed. A charge entered by mistake can be removed (its deposit part
--     goes back to the customer) as long as no charge payment was recorded.
--   * Customers can read their own charges, and open receipts of payments
--     on their bookings.
--   * A plain status change to RETURNED (older pages) still works and
--     credits the whole deposit, as before.
--
-- Deploy order: run before the frontend ships.
-- =====================================================================

begin;

alter table public.bubatrent_booking_bookings
  add column if not exists deposit_on_hold boolean not null default false,
  add column if not exists charges_total numeric(10,2) not null default 0,
  add column if not exists amount_owed numeric(10,2) not null default 0;

create table if not exists public.bubatrent_booking_charges (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bubatrent_booking_bookings(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  fleet_group_id uuid references public.bubatrent_booking_fleet_groups(id),
  kind text not null check (kind in ('late_return', 'cleaning', 'fuel', 'damage', 'other')),
  amount numeric(10,2) not null check (amount > 0),
  -- The part taken from the booking's deposit; the rest was owed
  from_deposit numeric(10,2) not null default 0 check (from_deposit >= 0 and from_deposit <= amount),
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists bubatrent_booking_charges_booking_idx
  on public.bubatrent_booking_charges (booking_id);

alter table public.bubatrent_booking_charges enable row level security;
revoke all on public.bubatrent_booking_charges from anon;
revoke insert, update, delete, truncate on public.bubatrent_booking_charges from authenticated;
grant select on public.bubatrent_booking_charges to authenticated;

drop policy if exists "Customers see their own charges" on public.bubatrent_booking_charges;
create policy "Customers see their own charges"
  on public.bubatrent_booking_charges for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Admins see charges in their fleets" on public.bubatrent_booking_charges;
create policy "Admins see charges in their fleets"
  on public.bubatrent_booking_charges for select to authenticated
  using (public.bubatrent_is_admin() and public.bubatrent_can_access_booking(booking_id));

-- ---------------------------------------------------------------------
-- 1. Deposit arithmetic (same results as 20261015030000)
-- ---------------------------------------------------------------------
-- What would go back to the customer now: a verified deposit not yet
-- returned (less applied credit that already came back), or for an
-- unverified deposit only the credit applied to it.
create or replace function public.bubatrent_booking_deposit_due(p_booking public.bubatrent_booking_bookings)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_applied numeric;
begin
  if p_booking.user_id is null or p_booking.deposit_credited_at is not null then
    return 0;
  end if;
  if p_booking.deposit_status = 'verified' then
    select coalesce(-sum(t.amount), 0) into v_applied
      from public.bubatrent_booking_credit_transactions t
     where t.booking_id = p_booking.id and t.type = 'applied';
    return greatest(
      coalesce(p_booking.deposit_amount, 0)
        - greatest(v_applied - coalesce(p_booking.credit_applied, 0), 0), 0);
  end if;
  return greatest(coalesce(p_booking.credit_applied, 0), 0);
end;
$$;

revoke all on function public.bubatrent_booking_deposit_due(public.bubatrent_booking_bookings)
  from public, anon, authenticated;

create or replace function public.bubatrent_give_back_booking_credit(
  p_booking public.bubatrent_booking_bookings,
  p_description text
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount numeric := public.bubatrent_booking_deposit_due(p_booking);
begin
  if v_amount > 0 then
    update public.bubatrent_booking_profiles
       set deposit_credit = coalesce(deposit_credit, 0) + v_amount
     where id = p_booking.user_id;
    insert into public.bubatrent_booking_credit_transactions (
      user_id, booking_id, amount, type, description, admin_id, fleet_group_id
    ) values (
      p_booking.user_id, p_booking.id, v_amount, 'deposit_return', p_description,
      case when public.bubatrent_is_admin() then auth.uid() end, p_booking.fleet_group_id
    );
  end if;
  return v_amount;
end;
$$;

revoke all on function public.bubatrent_give_back_booking_credit(public.bubatrent_booking_bookings, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Return/cancel trigger: a held deposit is credited when released
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_track_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- This function runs as its owner, so current_user can't tell a website
  -- request apart; the role setting still holds the request's role.
  v_from_site boolean := coalesce(current_setting('role', true), '') in ('anon', 'authenticated');
begin
  new.updated_at := now();

  if v_from_site and new.status is distinct from old.status then
    if new.status = 'CONFIRMED' and coalesce(new.deposit_status, '') <> 'verified' then
      raise exception 'Verify the deposit before confirming this booking.' using errcode = '22023';
    end if;
    if new.status = 'PICKUP' then
      if not exists (
        select 1 from public.bubatrent_booking_rental_agreements a where a.booking_id = new.id
      ) then
        raise exception 'Cannot mark as picked up: the rental agreement has not been signed yet.'
          using errcode = '22023';
      end if;
      if coalesce(new.full_payment_status, '') <> 'verified' then
        raise exception 'Cannot mark as picked up: verify the full rental payment first.'
          using errcode = '22023';
      end if;
    end if;
    if new.status = 'RETURNED' and old.status <> 'PICKUP' then
      raise exception 'Only a booking that was picked up can be marked returned.'
        using errcode = '22023';
    end if;
  end if;

  -- The deposit goes back to the customer as credit once the booking is
  -- over: returned (unless held for damage checks), released from hold, or
  -- cancelled after the deposit was verified.
  if new.user_id is not null
     and new.deposit_credited_at is null
     and new.status in ('RETURNED', 'CANCELLED')
     and new.deposit_status = 'verified'
     and not (new.status = 'RETURNED' and new.deposit_on_hold)
     and (new.status is distinct from old.status
          or old.deposit_status is distinct from 'verified'
          or (old.deposit_on_hold and not new.deposit_on_hold)) then
    perform public.bubatrent_give_back_booking_credit(
      new,
      case when new.status = 'RETURNED' then 'Deposit returned after the rental'
           else 'Deposit returned: booking cancelled' end);
    new.deposit_credited_at := now();

  -- Cancelled before the deposit was verified: give back the credit the
  -- customer applied to it.
  elsif new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED'
        and new.user_id is not null
        and new.deposit_credited_at is null
        and coalesce(new.deposit_status, '') <> 'verified'
        and coalesce(new.credit_applied, 0) > 0 then
    perform public.bubatrent_give_back_booking_credit(new, 'Booking cancelled: credit returned');
    new.credit_applied := 0;
  end if;

  return new;
end;
$$;

revoke all on function public.bubatrent_track_booking() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Audit trigger, as in 20261015020000 plus deposit hold/release
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_audit_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_by text := case when auth.uid() is null then 'system'
                    when public.bubatrent_is_admin() then 'admin'
                    else 'customer' end;
  v_submit boolean := old.status = 'HOLD' and new.status = 'DEPOSIT_PAID';
  v_log jsonb := '[]'::jsonb;
  v_credit numeric;
begin
  -- Expiry is routine (holds) or logged by the 48-hour release itself, and
  -- a HOLD cancelled at checkout is an abandoned cart.
  if new.status is distinct from old.status
     and new.status <> 'EXPIRED'
     and not (old.status = 'HOLD' and new.status = 'CANCELLED') then
    v_log := v_log || jsonb_build_object(
      'action', case
        when old.status = 'EXPIRED' then 'REACTIVATE_EXPIRED'
        when v_submit then 'SUBMIT_DEPOSIT'
        when new.status = 'CONFIRMED' then 'CONFIRM_BOOKING'
        when new.status = 'PICKUP' then 'MARK_PICKED_UP'
        when new.status = 'RETURNED' then 'MARK_RETURNED'
        when new.status = 'CANCELLED' then 'CANCEL_BOOKING'
        else 'CHANGE_STATUS' end,
      'details', jsonb_build_object('from', old.status, 'to', new.status)
        || case when old.status = 'EXPIRED'
             then jsonb_build_object('reason', new.reactivation_reason) else '{}'::jsonb end
        || case when v_submit
             then jsonb_build_object('amount', new.deposit_amount, 'credit_applied', new.credit_applied)
             else '{}'::jsonb end
        || case when new.status = 'RETURNED' and new.status is distinct from old.status
             then jsonb_build_object('actual_return_date', new.actual_return_date) else '{}'::jsonb end);
  end if;

  if new.deposit_status is distinct from old.deposit_status and not v_submit then
    v_log := v_log || jsonb_build_object(
      'action', case new.deposit_status
        when 'verified' then 'VERIFY_DEPOSIT'
        when 'rejected' then 'REJECT_DEPOSIT'
        when 'uploaded' then 'UPLOAD_DEPOSIT_RECEIPT'
        else 'CHANGE_DEPOSIT_STATUS' end,
      'details', jsonb_build_object(
        'from', old.deposit_status, 'to', new.deposit_status, 'amount', new.deposit_amount));
  end if;

  if new.full_payment_status is distinct from old.full_payment_status then
    v_log := v_log || jsonb_build_object(
      'action', case new.full_payment_status
        when 'verified' then 'VERIFY_FULL_PAYMENT'
        when 'uploaded' then 'UPLOAD_FULL_PAYMENT'
        else 'CHANGE_FULL_PAYMENT_STATUS' end,
      'details', jsonb_build_object(
        'from', old.full_payment_status, 'to', new.full_payment_status,
        'amount', coalesce(new.full_payment_amount, new.total_price)));
  end if;

  if new.pickup_date is distinct from old.pickup_date
     or new.return_date is distinct from old.return_date then
    v_log := v_log || jsonb_build_object(
      'action', 'CHANGE_DATES',
      'details', jsonb_build_object(
        'from', old.pickup_date || ' → ' || old.return_date,
        'to', new.pickup_date || ' → ' || new.return_date));
  end if;

  if new.total_price is distinct from old.total_price
     or new.deposit_amount is distinct from old.deposit_amount then
    v_log := v_log || jsonb_build_object(
      'action', 'CHANGE_PRICE',
      'details', jsonb_build_object(
        'total_from', old.total_price, 'total_to', new.total_price,
        'deposit_from', old.deposit_amount, 'deposit_to', new.deposit_amount));
  end if;

  if new.deposit_on_hold is distinct from old.deposit_on_hold then
    v_log := v_log || jsonb_build_object(
      'action', case when new.deposit_on_hold then 'HOLD_DEPOSIT' else 'RELEASE_DEPOSIT' end,
      'details', jsonb_build_object('amount', new.deposit_amount));
  end if;

  if new.deposit_credited_at is not null and old.deposit_credited_at is null then
    -- The ledger row bubatrent_track_booking wrote in this transaction
    select coalesce(sum(t.amount), 0) into v_credit
      from public.bubatrent_booking_credit_transactions t
     where t.booking_id = new.id and t.type = 'deposit_return' and t.created_at = now();
    v_log := v_log || jsonb_build_object(
      'action', 'DEPOSIT_TO_CREDIT', 'details', jsonb_build_object('amount', v_credit));
  end if;

  if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED'
     and coalesce(old.credit_applied, 0) > 0 and coalesce(new.credit_applied, 0) = 0 then
    v_log := v_log || jsonb_build_object(
      'action', 'RETURN_APPLIED_CREDIT', 'details', jsonb_build_object('amount', old.credit_applied));
  end if;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  select auth.uid(), e->>'action', 'booking', new.id, (e->'details') || jsonb_build_object('by', v_by)
    from jsonb_array_elements(v_log) e;

  return null;
end;
$$;

revoke all on function public.bubatrent_audit_booking() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Charges
-- ---------------------------------------------------------------------
-- Records charges for a booking, taking up to p_from_deposit from the
-- deposit that was just credited (in list order); the rest is owed.
-- Internal: called by the admin functions below.
create or replace function public.bubatrent_apply_booking_charges(
  p_booking_id uuid,
  p_charges jsonb,
  p_from_deposit numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings;
  v_charge jsonb;
  v_kind text;
  v_label text;
  v_desc text;
  v_amount numeric;
  v_take numeric;
  v_left numeric := greatest(coalesce(p_from_deposit, 0), 0);
  v_total numeric := 0;
  v_taken numeric := 0;
begin
  if p_charges is null or jsonb_typeof(p_charges) <> 'array' then
    raise exception 'Charges must be a list.' using errcode = '22023';
  end if;
  select * into v_booking from public.bubatrent_booking_bookings where id = p_booking_id;

  for v_charge in select * from jsonb_array_elements(p_charges) loop
    v_kind := v_charge->>'kind';
    v_desc := nullif(trim(coalesce(v_charge->>'description', '')), '');
    begin
      v_amount := round((v_charge->>'amount')::numeric, 2);
    exception when others then
      raise exception 'Enter a valid amount for each charge.' using errcode = '22023';
    end;
    v_label := case v_kind
      when 'late_return' then 'Late return'
      when 'cleaning' then 'Cleaning'
      when 'fuel' then 'Fuel'
      when 'damage' then 'Damage'
      when 'other' then 'Other charge' end;
    if v_label is null then
      raise exception 'Unknown charge type.' using errcode = '22023';
    end if;
    if v_amount is null or v_amount <= 0 or v_amount > 100000 then
      raise exception 'Each charge needs an amount between RM0.01 and RM100,000.' using errcode = '22023';
    end if;
    if v_kind in ('damage', 'other') and v_desc is null then
      raise exception 'Describe the % charge.', lower(v_label) using errcode = '22023';
    end if;

    v_take := least(v_amount, v_left);
    v_left := v_left - v_take;

    insert into public.bubatrent_booking_charges (
      booking_id, user_id, fleet_group_id, kind, amount, from_deposit, description, created_by
    ) values (
      v_booking.id, v_booking.user_id, v_booking.fleet_group_id, v_kind, v_amount, v_take,
      v_desc, auth.uid()
    );
    if v_take > 0 then
      insert into public.bubatrent_booking_credit_transactions (
        user_id, booking_id, amount, type, description, admin_id, fleet_group_id
      ) values (
        v_booking.user_id, v_booking.id, -v_take, 'deducted',
        v_label || coalesce(': ' || v_desc, '') || ' (from deposit)', auth.uid(),
        v_booking.fleet_group_id
      );
    end if;
    insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
    values (auth.uid(), 'CHARGE_ADDED', 'booking', v_booking.id,
      jsonb_build_object('kind', v_kind, 'label', v_label, 'amount', v_amount,
                         'from_deposit', v_take, 'description', v_desc, 'by', 'admin'));

    v_total := v_total + v_amount;
    v_taken := v_taken + v_take;
  end loop;

  if v_taken > 0 then
    update public.bubatrent_booking_profiles
       set deposit_credit = coalesce(deposit_credit, 0) - v_taken
     where id = v_booking.user_id;
  end if;
  if v_total > 0 then
    update public.bubatrent_booking_bookings
       set charges_total = charges_total + v_total,
           amount_owed = amount_owed + (v_total - v_taken)
     where id = p_booking_id;
  end if;

  return jsonb_build_object('charged', v_total, 'from_deposit', v_taken, 'owed', v_total - v_taken);
end;
$$;

revoke all on function public.bubatrent_apply_booking_charges(uuid, jsonb, numeric)
  from public, anon, authenticated;

-- Locks a booking for an admin in its fleet, or raises.
create or replace function public.bubatrent_admin_lock_booking(p_booking_id uuid)
returns public.bubatrent_booking_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings;
begin
  if not public.bubatrent_is_admin() then
    raise exception 'Not authorized: admin role required' using errcode = '42501';
  end if;
  select * into v_booking from public.bubatrent_booking_bookings
   where id = p_booking_id
   for update;
  if not found or not public.bubatrent_can_access_fleet(v_booking.fleet_group_id) then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;
  return v_booking;
end;
$$;

revoke all on function public.bubatrent_admin_lock_booking(uuid) from public, anon, authenticated;

-- Mark Returned, with charges taken from the deposit, or with the deposit
-- held until it is settled.
create or replace function public.bubatrent_admin_return_booking(
  p_booking_id uuid,
  p_charges jsonb default '[]'::jsonb,
  p_hold_deposit boolean default false,
  p_return_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings := public.bubatrent_admin_lock_booking(p_booking_id);
  v_hold boolean := coalesce(p_hold_deposit, false);
  v_charges jsonb := coalesce(p_charges, '[]'::jsonb);
  v_date date := coalesce(p_return_date, (now() at time zone 'Asia/Kuala_Lumpur')::date);
  v_due numeric;
  v_result jsonb := jsonb_build_object('charged', 0, 'from_deposit', 0, 'owed', 0);
begin
  if v_booking.status <> 'PICKUP' then
    raise exception 'Only a booking that was picked up can be marked returned.' using errcode = '22023';
  end if;
  if v_hold and jsonb_typeof(v_charges) = 'array' and jsonb_array_length(v_charges) > 0 then
    raise exception 'Enter the charges when you settle the held deposit.' using errcode = '22023';
  end if;
  if v_date < v_booking.pickup_date then
    raise exception 'The return date can''t be before the pickup date.' using errcode = '22023';
  end if;

  v_due := case when v_booking.deposit_status = 'verified'
                then public.bubatrent_booking_deposit_due(v_booking) else 0 end;

  -- bubatrent_track_booking credits the deposit here unless it is held
  update public.bubatrent_booking_bookings
     set status = 'RETURNED', actual_return_date = v_date, deposit_on_hold = v_hold
   where id = p_booking_id;

  if not v_hold then
    v_result := public.bubatrent_apply_booking_charges(p_booking_id, v_charges, v_due);
  end if;

  return v_result || jsonb_build_object(
    'deposit', v_due,
    'held', v_hold,
    'credited', case when v_hold then 0 else v_due - (v_result->>'from_deposit')::numeric end);
end;
$$;

-- Release a held deposit: charges come off it, the rest goes to credit.
create or replace function public.bubatrent_admin_settle_deposit(
  p_booking_id uuid,
  p_charges jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings := public.bubatrent_admin_lock_booking(p_booking_id);
  v_due numeric;
  v_result jsonb;
begin
  if v_booking.status <> 'RETURNED' or not v_booking.deposit_on_hold then
    raise exception 'This booking''s deposit is not on hold.' using errcode = '22023';
  end if;

  v_due := case when v_booking.deposit_status = 'verified'
                then public.bubatrent_booking_deposit_due(v_booking) else 0 end;

  -- bubatrent_track_booking credits the deposit when the hold is lifted
  update public.bubatrent_booking_bookings
     set deposit_on_hold = false
   where id = p_booking_id;

  v_result := public.bubatrent_apply_booking_charges(p_booking_id, coalesce(p_charges, '[]'::jsonb), v_due);
  return v_result || jsonb_build_object(
    'deposit', v_due, 'credited', v_due - (v_result->>'from_deposit')::numeric);
end;
$$;

-- Charges found after the deposit was settled: owed by the customer.
create or replace function public.bubatrent_admin_add_booking_charges(
  p_booking_id uuid,
  p_charges jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings := public.bubatrent_admin_lock_booking(p_booking_id);
begin
  if v_booking.status <> 'RETURNED' then
    raise exception 'Charges can only be added to a returned booking.' using errcode = '22023';
  end if;
  if v_booking.deposit_on_hold then
    raise exception 'The deposit is on hold: add the charges when you settle it.' using errcode = '22023';
  end if;
  if coalesce(jsonb_array_length(p_charges), 0) = 0 then
    raise exception 'Add at least one charge.' using errcode = '22023';
  end if;
  return public.bubatrent_apply_booking_charges(p_booking_id, p_charges, 0);
end;
$$;

-- Undo a charge entered by mistake (only before any charge payment).
create or replace function public.bubatrent_admin_remove_booking_charge(
  p_charge_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge public.bubatrent_booking_charges;
  v_booking public.bubatrent_booking_bookings;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into v_charge from public.bubatrent_booking_charges where id = p_charge_id;
  if not found then
    raise exception 'Charge not found.' using errcode = 'P0002';
  end if;
  v_booking := public.bubatrent_admin_lock_booking(v_charge.booking_id);
  if v_reason is null then
    raise exception 'Give a reason for removing the charge.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.bubatrent_booking_payments p
     where p.booking_id = v_booking.id and p.payment_type = 'charge' and p.status = 'completed'
  ) then
    raise exception 'A charge payment is already recorded on this booking. To give money back, use Add Credit on the customer.'
      using errcode = '22023';
  end if;

  if v_charge.from_deposit > 0 and v_booking.user_id is not null then
    update public.bubatrent_booking_profiles
       set deposit_credit = coalesce(deposit_credit, 0) + v_charge.from_deposit
     where id = v_booking.user_id;
    insert into public.bubatrent_booking_credit_transactions (
      user_id, booking_id, amount, type, description, admin_id, fleet_group_id
    ) values (
      v_booking.user_id, v_booking.id, v_charge.from_deposit, 'deposit_return',
      'Charge removed, deposit part returned: ' || v_reason, auth.uid(), v_booking.fleet_group_id
    );
  end if;

  update public.bubatrent_booking_bookings
     set charges_total = greatest(charges_total - v_charge.amount, 0),
         amount_owed = greatest(amount_owed - (v_charge.amount - v_charge.from_deposit), 0)
   where id = v_booking.id;
  delete from public.bubatrent_booking_charges where id = p_charge_id;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (auth.uid(), 'CHARGE_REMOVED', 'booking', v_booking.id,
    jsonb_build_object('kind', v_charge.kind, 'amount', v_charge.amount,
                       'from_deposit', v_charge.from_deposit, 'description', v_charge.description,
                       'reason', v_reason, 'by', 'admin'));

  return jsonb_build_object('removed', v_charge.amount, 'credited', v_charge.from_deposit);
end;
$$;

-- Money collected for what the customer owes.
create or replace function public.bubatrent_admin_record_charge_payment(
  p_booking_id uuid,
  p_amount numeric,
  p_method text,
  p_receipt_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings := public.bubatrent_admin_lock_booking(p_booking_id);
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_receipt text := nullif(trim(coalesce(p_receipt_path, '')), '');
begin
  if v_amount <= 0 then
    raise exception 'Enter the amount received.' using errcode = '22023';
  end if;
  if v_amount > v_booking.amount_owed then
    raise exception 'That is more than the amount owed (RM%).', v_booking.amount_owed using errcode = '22023';
  end if;
  if p_method not in ('cash', 'bank_transfer') then
    raise exception 'Choose cash or bank transfer.' using errcode = '22023';
  end if;
  if v_receipt is not null and v_receipt not like 'receipts/' || p_booking_id::text || '/%' then
    raise exception 'Invalid receipt path.' using errcode = '22023';
  end if;

  insert into public.bubatrent_booking_payments (
    booking_id, amount, payment_method, status, simulated, payment_type,
    receipt_path, reference_number, fleet_group_id
  ) values (
    p_booking_id, v_amount, p_method, 'completed', false, 'charge', v_receipt,
    'CHG-' || upper(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint)),
    v_booking.fleet_group_id
  );
  update public.bubatrent_booking_bookings
     set amount_owed = amount_owed - v_amount
   where id = p_booking_id;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (auth.uid(), 'CHARGE_PAYMENT', 'booking', p_booking_id,
    jsonb_build_object('amount', v_amount, 'method', p_method, 'by', 'admin'));

  return jsonb_build_object('received', v_amount, 'still_owed', v_booking.amount_owed - v_amount);
end;
$$;

revoke all on function public.bubatrent_admin_return_booking(uuid, jsonb, boolean, date) from public, anon;
revoke all on function public.bubatrent_admin_settle_deposit(uuid, jsonb) from public, anon;
revoke all on function public.bubatrent_admin_add_booking_charges(uuid, jsonb) from public, anon;
revoke all on function public.bubatrent_admin_remove_booking_charge(uuid, text) from public, anon;
revoke all on function public.bubatrent_admin_record_charge_payment(uuid, numeric, text, text) from public, anon;
grant execute on function public.bubatrent_admin_return_booking(uuid, jsonb, boolean, date) to authenticated;
grant execute on function public.bubatrent_admin_settle_deposit(uuid, jsonb) to authenticated;
grant execute on function public.bubatrent_admin_add_booking_charges(uuid, jsonb) to authenticated;
grant execute on function public.bubatrent_admin_remove_booking_charge(uuid, text) to authenticated;
grant execute on function public.bubatrent_admin_record_charge_payment(uuid, numeric, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Customers can open receipts of any payment on their bookings
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_is_own_booking_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bubatrent_booking_bookings b
     where b.user_id = auth.uid()
       and p_name in (b.deposit_receipt_path, b.full_payment_receipt_path)
  ) or exists (
    select 1 from public.bubatrent_booking_payments p
      join public.bubatrent_booking_bookings b on b.id = p.booking_id
     where b.user_id = auth.uid() and p.receipt_path = p_name
  );
$$;

revoke all on function public.bubatrent_is_own_booking_file(text) from public, anon;
grant execute on function public.bubatrent_is_own_booking_file(text) to authenticated;

commit;
