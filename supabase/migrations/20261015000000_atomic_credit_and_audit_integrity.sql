-- =====================================================================
-- Atomic credit changes + audit integrity (2026-10-15)
--
-- What this fixes:
--   * Admin credit changes (verify deposit, add credit, deduct credit)
--     read the balance in the browser and wrote back "old + amount".
--     The customer list caches balances for a minute, so a change made
--     meanwhile (e.g. credit used at checkout) was silently overwritten.
--     Each change was also several separate writes: if one failed, the
--     deposit stayed "verified" without the credit, and could not be retried.
--   * The repo's ledger type check (migration_overhaul.sql) lacked 'added',
--     which the Add credit button uses. The live database already allowed
--     it (plus 'deposit_paid'); this records the live list in the repo.
--   * Audit log entries took admin_id and created_at from the browser, so
--     an admin could log actions under another admin's name or date.
--   * The full-payment receipt path a customer submits was not checked,
--     so it could point at any file in the documents bucket.
--
-- After this, deposit_credit and the credit ledger change only through
-- bubatrent_submit_booking_deposit, bubatrent_admin_verify_deposit and
-- bubatrent_admin_adjust_credit, which update both in one transaction.
--
-- Deploy order: run this migration, then deploy the matching frontend
-- right away. The old admin screens write deposit_credit directly, which
-- this migration intentionally blocks.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Credit ledger: allow every type the app records
-- ---------------------------------------------------------------------
-- Same list the live database has had since before this migration.
do $$
declare
  c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
     where con.conrelid = 'public.bubatrent_booking_credit_transactions'::regclass
       and con.contype = 'c'
       and a.attname = 'type'
  loop
    execute format('alter table public.bubatrent_booking_credit_transactions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.bubatrent_booking_credit_transactions
  add constraint bubatrent_booking_credit_transactions_type_check
  check (type in ('deposit_return', 'applied', 'added', 'deducted', 'payout', 'deposit_paid'));

-- Ledger rows are written only by the credit functions, so a row can never
-- exist without the matching balance change. Deleting (with a booking) stays.
drop policy if exists "Admins can create credit transactions" on public.bubatrent_booking_credit_transactions;

-- ---------------------------------------------------------------------
-- 2. Profiles: deposit_credit changes only through the credit functions
-- ---------------------------------------------------------------------
-- Same as 20261011120000 plus the deposit_credit check for every API caller,
-- admins included.
create or replace function public.bubatrent_protect_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.bubatrent_is_admin() then
      new.role := 'customer';
      new.is_verified := false;
      new.verified_by := null;
      new.verified_at := null;
      new.deposit_credit := 0;
      new.created_by_admin := null;
    elsif new.role is distinct from 'customer' and not public.bubatrent_is_super_admin() then
      raise exception 'Only super admins can assign admin roles' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'Profile id cannot be changed' using errcode = '42501';
  end if;

  if new.role is distinct from old.role and not public.bubatrent_is_super_admin() then
    raise exception 'Only super admins can change roles' using errcode = '42501';
  end if;

  -- A direct edit would leave the balance and the credit ledger disagreeing.
  if new.deposit_credit is distinct from old.deposit_credit then
    raise exception 'Credit can only be changed with Add credit, Deduct credit or deposit verification'
      using errcode = '42501';
  end if;

  if public.bubatrent_is_admin() then
    return new;
  end if;

  if new.is_verified is distinct from old.is_verified
     or new.verified_by is distinct from old.verified_by
     or new.verified_at is distinct from old.verified_at
     or new.created_by_admin is distinct from old.created_by_admin then
    raise exception 'Not allowed to change verification or credit fields' using errcode = '42501';
  end if;

  -- Once verified, identity details change only through an admin-approved
  -- verification update (bubatrent_booking_verification_updates).
  if old.is_verified and (
       new.ic_number is distinct from old.ic_number
    or new.licence_number is distinct from old.licence_number
    or new.licence_expiry is distinct from old.licence_expiry
    or new.ic_file_path is distinct from old.ic_file_path
    or new.licence_file_path is distinct from old.licence_file_path
    or new.gdl_license is distinct from old.gdl_license) then
    raise exception 'Verified identity details can only be changed through a verification update'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Admin credit functions
-- ---------------------------------------------------------------------
-- Verifies a deposit receipt and credits the deposit to the customer, once.
-- The row lock makes a double click or a second admin wait, then see
-- 'already_verified' instead of crediting twice.
create or replace function public.bubatrent_admin_verify_deposit(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings;
  v_balance numeric;
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
  if v_booking.deposit_status = 'verified' then
    return jsonb_build_object('status', 'already_verified');
  end if;

  update public.bubatrent_booking_bookings
     set deposit_status = 'verified', updated_at = now()
   where id = p_booking_id;

  update public.bubatrent_booking_payments
     set status = 'completed'
   where booking_id = p_booking_id and payment_type = 'deposit';

  if coalesce(v_booking.deposit_amount, 0) > 0 and v_booking.user_id is not null then
    update public.bubatrent_booking_profiles
       set deposit_credit = coalesce(deposit_credit, 0) + v_booking.deposit_amount
     where id = v_booking.user_id
    returning deposit_credit into v_balance;

    insert into public.bubatrent_booking_credit_transactions (
      user_id, booking_id, amount, type, description, admin_id, fleet_group_id
    ) values (
      v_booking.user_id, p_booking_id, v_booking.deposit_amount, 'deposit_return',
      'Deposit verified — credit added', auth.uid(), v_booking.fleet_group_id
    );
  end if;

  return jsonb_build_object('status', 'verified', 'balance', v_balance);
end;
$$;

-- Adds (positive amount) or deducts (negative amount) customer credit and
-- records it in the ledger. Returns the new balance.
create or replace function public.bubatrent_admin_adjust_credit(
  p_user_id uuid,
  p_amount numeric,
  p_description text default null,
  p_fleet_group_id uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount numeric := round(p_amount, 2);
  v_balance numeric;
begin
  if not public.bubatrent_is_admin() then
    raise exception 'Not authorized: admin role required' using errcode = '42501';
  end if;
  if v_amount is null or v_amount = 0 then
    raise exception 'Enter a valid amount.' using errcode = '22023';
  end if;
  -- Same scope the ledger policy enforced: the admin's own fleets, and only
  -- super admins may record credit without a fleet.
  if not public.bubatrent_can_access_fleet(p_fleet_group_id) then
    raise exception 'You can only change credit for your own fleet.' using errcode = '42501';
  end if;

  select coalesce(deposit_credit, 0) into v_balance
    from public.bubatrent_booking_profiles
   where id = p_user_id
   for update;
  if not found then
    raise exception 'Customer not found.' using errcode = 'P0002';
  end if;
  if v_balance + v_amount < 0 then
    raise exception 'Cannot deduct more than the balance of RM%.', to_char(v_balance, 'FM999999990.00')
      using errcode = '22023';
  end if;

  update public.bubatrent_booking_profiles
     set deposit_credit = v_balance + v_amount
   where id = p_user_id;

  insert into public.bubatrent_booking_credit_transactions (
    user_id, amount, type, description, admin_id, fleet_group_id
  ) values (
    p_user_id,
    v_amount,
    case when v_amount > 0 then 'added' else 'deducted' end,
    coalesce(nullif(trim(p_description), ''),
             case when v_amount > 0 then 'Manual credit (admin)' else 'Admin deduction' end),
    auth.uid(),
    p_fleet_group_id
  );

  return v_balance + v_amount;
end;
$$;

revoke all on function public.bubatrent_admin_verify_deposit(uuid) from public, anon;
revoke all on function public.bubatrent_admin_adjust_credit(uuid, numeric, text, uuid) from public, anon;
grant execute on function public.bubatrent_admin_verify_deposit(uuid) to authenticated;
grant execute on function public.bubatrent_admin_adjust_credit(uuid, numeric, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Audit log: the database records who acted and when
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_stamp_audit_log()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.admin_id := auth.uid();
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists bubatrent_stamp_audit_log on public.bubatrent_booking_audit_logs;
create trigger bubatrent_stamp_audit_log
  before insert on public.bubatrent_booking_audit_logs
  for each row execute function public.bubatrent_stamp_audit_log();

-- ---------------------------------------------------------------------
-- 5. Bookings: full-payment receipts must belong to the booking
-- ---------------------------------------------------------------------
-- Same as 20261011120000 plus the receipt path check, matching the one
-- bubatrent_submit_booking_deposit applies to deposit receipts.
create or replace function public.bubatrent_protect_booking()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  customer_editable constant text[] := array[
    'customer_name', 'customer_email', 'customer_phone', 'notes', 'updated_at',
    'status', 'full_payment_status', 'full_payment_receipt_path'
  ];
begin
  if current_user not in ('anon', 'authenticated') or public.bubatrent_is_admin() then
    return new;
  end if;

  if (to_jsonb(new) - customer_editable) is distinct from (to_jsonb(old) - customer_editable) then
    raise exception 'Not allowed to change these booking fields' using errcode = '42501';
  end if;

  if new.status is distinct from old.status and not (
       (new.status = 'CANCELLED' and old.status in ('HOLD', 'DEPOSIT_PAID'))
    or (new.status = 'EXPIRED' and old.status = 'HOLD')) then
    raise exception 'Not allowed to change booking status from % to %', old.status, new.status
      using errcode = '42501';
  end if;

  if (new.full_payment_status is distinct from old.full_payment_status
      or new.full_payment_receipt_path is distinct from old.full_payment_receipt_path)
     and (old.full_payment_status = 'verified' or new.full_payment_status is distinct from 'uploaded') then
    raise exception 'Not allowed to change the full payment status' using errcode = '42501';
  end if;

  if new.full_payment_receipt_path is distinct from old.full_payment_receipt_path
     and coalesce(new.full_payment_receipt_path, '') not like 'receipts/' || old.id::text || '/%' then
    raise exception 'Invalid receipt path.' using errcode = '22023';
  end if;

  return new;
end;
$$;

commit;
