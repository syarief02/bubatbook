-- =====================================================================
-- Changing a rental after booking: price, longer, shorter, another car;
-- and cheaper long rentals (2026-10-16)
--
-- Until now a booking's price was days x the car's daily rate, fixed at
-- booking; dates could only move before pickup (without repricing); a car
-- could not be extended, ended early or swapped once picked up.
--
-- Now (decided with the owner):
--   * Long-rental rates per fleet (Fleet Settings): weekly_discount_pct for
--     7+ days, monthly_discount_pct for 30+ days (10% and 20% to start),
--     applied to online and counter bookings (bubatrent_rental_quote).
--   * Bookings keep rent_paid: rent received so far (payments, and what
--     the customer paid a workshop for us). Rent still to pay is
--     total_price - rent_paid, and the full payment is open again while
--     anything is left (an extension). Sales counts rent_paid.
--   * Every change is a row in bubatrent_booking_rental_changes, shown to
--     staff and to the customer (booking, invoice, agreement):
--       - price: an agreed price, with a reason (Book for Customer, or
--         bubatrent_admin_change_rental_price). Any admin; logged.
--       - extension (bubatrent_admin_extend_rental): a later return date
--         if the car is free; extra rent at the rate for the new length,
--         or an agreed amount with a reason.
--       - early_return (bubatrent_admin_end_rental_early): an earlier
--         return date. Customer's choice: the unused days less a 25%
--         penalty on the rental (agreement). Breakdown with no replacement:
--         the unused days, no penalty. Staff can change the amount, with a
--         reason.
--       - car_change (bubatrent_admin_replace_car): another car of the
--         fleet from a given day, same price. The booking then blocks the
--         new car from that day only (car_since).
--   * Money paid above a lowered price goes to the customer's credit.
--
-- Deploy order: run before the frontend ships. The old pages keep
-- working; Book for Customer gains two optional parameters.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Long-rental rates
-- ---------------------------------------------------------------------
alter table public.bubatrent_booking_fleet_groups
  add column if not exists weekly_discount_pct numeric(5,2) not null default 0,
  add column if not exists monthly_discount_pct numeric(5,2) not null default 0;
alter table public.bubatrent_booking_fleet_groups
  drop constraint if exists bubatrent_fleet_discount_pct_range;
alter table public.bubatrent_booking_fleet_groups
  add constraint bubatrent_fleet_discount_pct_range
  check (weekly_discount_pct between 0 and 90 and monthly_discount_pct between 0 and 90);

-- The rates the owner chose to start with
update public.bubatrent_booking_fleet_groups
   set weekly_discount_pct = 10, monthly_discount_pct = 20
 where weekly_discount_pct = 0 and monthly_discount_pct = 0;

-- For the car pages (visitors can't read fleets)
create or replace function public.bubatrent_long_rental_rates(p_fleet_group_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('weekly_discount_pct', f.weekly_discount_pct,
                            'monthly_discount_pct', f.monthly_discount_pct)
    from public.bubatrent_booking_fleet_groups f
   where f.id = p_fleet_group_id;
$$;

-- The price of renting a car for some days: the daily rate, less the
-- fleet's weekly (7+ days) or monthly (30+ days) discount
create or replace function public.bubatrent_rental_quote(p_car_id uuid, p_days integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'days', p_days, 'rate', c.price_per_day, 'base', x.base, 'discount_pct', x.pct,
    'long_discount', round(x.base * x.pct / 100, 2),
    'total', x.base - round(x.base * x.pct / 100, 2))
    from public.bubatrent_booking_cars c
    left join public.bubatrent_booking_fleet_groups f on f.id = c.fleet_group_id
    cross join lateral (
      select p_days * c.price_per_day as base,
             case when p_days >= 30 then coalesce(f.monthly_discount_pct, 0)
                  when p_days >= 7 then coalesce(f.weekly_discount_pct, 0)
                  else 0 end as pct) x
   where c.id = p_car_id;
$$;

revoke all on function public.bubatrent_rental_quote(uuid, integer) from public, anon, authenticated;
revoke all on function public.bubatrent_long_rental_rates(uuid) from public;
grant execute on function public.bubatrent_long_rental_rates(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Booking columns
-- ---------------------------------------------------------------------
alter table public.bubatrent_booking_bookings
  add column if not exists long_rental_discount numeric(10,2) not null default 0,
  add column if not exists rent_paid numeric(10,2) not null default 0,
  -- First day of the current car, when it was replaced during the rental
  add column if not exists car_since date;

alter table public.bubatrent_booking_bookings
  drop constraint if exists bubatrent_booking_car_since_check;
alter table public.bubatrent_booking_bookings
  add constraint bubatrent_booking_car_since_check
  check (car_since is null or (car_since > pickup_date and car_since <= return_date));

-- Rent already received: a verified full payment was the whole rental
update public.bubatrent_booking_bookings
   set rent_paid = coalesce(full_payment_amount, total_price)
 where full_payment_status = 'verified' and rent_paid = 0;
-- Unverified: what the customer paid a workshop for us
update public.bubatrent_booking_bookings b
   set rent_paid = w.to_rent
  from (select booking_id, sum(to_rent) as to_rent
          from public.bubatrent_booking_workshop_payments group by booking_id) w
 where w.booking_id = b.id and coalesce(b.full_payment_status, '') <> 'verified';

-- A replaced car is only blocked from the day it joined the rental
alter table public.bubatrent_booking_bookings drop constraint if exists bubatrent_bookings_no_overlap;
alter table public.bubatrent_booking_bookings
  add constraint bubatrent_bookings_no_overlap
  exclude using gist (
    car_id with =,
    daterange(coalesce(car_since, pickup_date), return_date, '[]') with &&
  ) where (status = any (array['HOLD', 'DEPOSIT_PAID', 'CONFIRMED', 'PICKUP']));

create or replace function public.bubatrent_check_availability(p_car_id uuid, p_pickup date, p_return date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.bubatrent_booking_bookings b
     where b.car_id = p_car_id
       and b.status in ('HOLD', 'DEPOSIT_PAID', 'CONFIRMED', 'PICKUP')
       and not (b.status = 'HOLD' and b.hold_expires_at < now())
       and not (b.status = 'DEPOSIT_PAID'
                and coalesce(b.deposit_status, '') <> 'verified'
                and b.deposit_review_due_at < now())
       and coalesce(b.car_since, b.pickup_date) <= p_return
       and b.return_date >= p_pickup
  );
$$;

-- ---------------------------------------------------------------------
-- 3. The changes
-- ---------------------------------------------------------------------
create table if not exists public.bubatrent_booking_rental_changes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bubatrent_booking_bookings(id) on delete cascade,
  kind text not null check (kind in ('price', 'extension', 'early_return', 'car_change')),
  -- Change to the rental price: more (+) or less (-)
  amount numeric(10,2) not null default 0,
  old_return date,
  new_return date,
  -- Early return: why, and the part of the unused days kept
  reason text check (reason is null or reason in ('customer', 'breakdown')),
  penalty numeric(10,2),
  -- Car change: from which day the new car
  from_car_id uuid references public.bubatrent_booking_cars(id) on delete set null,
  to_car_id uuid references public.bubatrent_booking_cars(id) on delete set null,
  change_date date,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists bubatrent_booking_rental_changes_booking_idx
  on public.bubatrent_booking_rental_changes (booking_id);

alter table public.bubatrent_booking_rental_changes enable row level security;
revoke all on public.bubatrent_booking_rental_changes from anon;
revoke insert, update, delete, truncate on public.bubatrent_booking_rental_changes from authenticated;
grant select on public.bubatrent_booking_rental_changes to authenticated;

drop policy if exists "Booking owner and fleet admins see rental changes"
  on public.bubatrent_booking_rental_changes;
create policy "Booking owner and fleet admins see rental changes"
  on public.bubatrent_booking_rental_changes for select to authenticated
  using (public.bubatrent_can_access_booking(booking_id));

-- ---------------------------------------------------------------------
-- 4. Rent still to pay, and settling after a price change
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_booking_rent_due(p_booking public.bubatrent_booking_bookings)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_booking.full_payment_status = 'verified' then 0
    else greatest(p_booking.total_price - p_booking.rent_paid, 0) end;
$$;

revoke all on function public.bubatrent_booking_rent_due(public.bubatrent_booking_bookings)
  from public, anon, authenticated;

-- After the rental price changed: rent paid above the new price goes to the
-- customer's credit; the full payment is open again while rent is left to
-- pay, and complete once it is all paid. Returns the amount given back.
create or replace function public.bubatrent_settle_rent(p_booking_id uuid, p_description text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings;
  v_refund numeric := 0;
begin
  select * into v_booking from public.bubatrent_booking_bookings where id = p_booking_id for update;
  if v_booking.rent_paid > v_booking.total_price then
    v_refund := v_booking.rent_paid - v_booking.total_price;
    -- Without a customer account staff refund it by hand (the page says so)
    if v_booking.user_id is not null then
      update public.bubatrent_booking_profiles
         set deposit_credit = coalesce(deposit_credit, 0) + v_refund
       where id = v_booking.user_id;
      insert into public.bubatrent_booking_credit_transactions (
        user_id, booking_id, amount, type, description, admin_id, fleet_group_id
      ) values (
        v_booking.user_id, p_booking_id, v_refund, 'added', p_description,
        auth.uid(), v_booking.fleet_group_id
      );
    end if;
  end if;

  update public.bubatrent_booking_bookings
     set rent_paid = least(rent_paid, total_price),
         full_payment_amount = total_price,
         full_payment_status = case
           when rent_paid >= total_price then 'verified'
           when full_payment_status = 'verified' then 'pending'
           else full_payment_status end
   where id = p_booking_id;
  return v_refund;
end;
$$;

revoke all on function public.bubatrent_settle_rent(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Paying the rent and workshop payments count towards rent_paid
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_admin_verify_full_payment(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings := public.bubatrent_admin_lock_booking(p_booking_id);
  v_due numeric := public.bubatrent_booking_rent_due(v_booking);
  -- A receipt waiting to be checked; otherwise it was paid in cash
  v_receipt text := case when v_booking.full_payment_status = 'uploaded'
                         then v_booking.full_payment_receipt_path end;
begin
  if v_booking.full_payment_status = 'verified' then
    return jsonb_build_object('status', 'already_verified');
  end if;

  update public.bubatrent_booking_bookings
     set full_payment_status = 'verified',
         rent_paid = rent_paid + v_due
   where id = p_booking_id;

  if v_due > 0 then
    insert into public.bubatrent_booking_payments (
      booking_id, amount, payment_method, status, simulated, payment_type,
      receipt_path, reference_number, fleet_group_id
    ) values (
      p_booking_id, v_due,
      case when v_receipt is null then 'cash' else 'bank_transfer' end,
      'completed', false, 'full_payment', v_receipt,
      'FP-' || upper(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint)),
      v_booking.fleet_group_id
    );
  end if;

  return jsonb_build_object('status', 'verified', 'amount', v_due);
end;
$$;

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

  if v_to_rent > 0 then
    update public.bubatrent_booking_bookings
       set rent_paid = rent_paid + v_to_rent,
           -- It covers the rest of the rental: the full payment is complete
           full_payment_status = case when v_to_rent = v_rent_due then 'verified'
                                      else full_payment_status end
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

-- Removing one: the rent it paid is to pay again (even if the rest of the
-- rental was paid since)
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
  if v_payment.to_rent > 0 then
    update public.bubatrent_booking_bookings
       set rent_paid = greatest(rent_paid - v_payment.to_rent, 0),
           full_payment_status = case when greatest(rent_paid - v_payment.to_rent, 0) < total_price
                                      then 'pending' else full_payment_status end
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
-- 6. Online bookings: priced with the long-rental rates
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_create_hold_booking(p_car_id uuid, p_pickup date, p_return date)
returns public.bubatrent_booking_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_profile public.bubatrent_booking_profiles;
  v_car public.bubatrent_booking_cars;
  v_days integer;
  v_quote jsonb;
  v_total numeric;
  v_booking public.bubatrent_booking_bookings;
begin
  if v_uid is null then
    raise exception 'Please log in to book.' using errcode = '28000';
  end if;

  select * into v_profile from public.bubatrent_booking_profiles where id = v_uid;
  if not found or not coalesce(v_profile.is_verified, false)
     or (v_profile.licence_expiry is not null and v_profile.licence_expiry < v_today) then
    raise exception 'Your account must be verified before booking.' using errcode = '42501';
  end if;

  if p_pickup is null or p_return is null or p_return <= p_pickup then
    raise exception 'Return date must be after the pick-up date.' using errcode = '22023';
  end if;
  if p_pickup < v_today then
    raise exception 'Pick-up date cannot be in the past.' using errcode = '22023';
  end if;
  if p_return > (v_today + interval '6 months')::date then
    raise exception 'You can only book up to 6 months in advance.' using errcode = '22023';
  end if;

  select * into v_car from public.bubatrent_booking_cars where id = p_car_id;
  if not found then
    raise exception 'Car not found.' using errcode = 'P0002';
  end if;
  if v_car.is_available is false then
    raise exception 'This car is not available for booking right now.' using errcode = '22023';
  end if;

  -- Free dates held by abandoned checkouts and by deposits not verified in
  -- time, and release this customer's own earlier holds (re-entering
  -- checkout must not block itself).
  update public.bubatrent_booking_bookings
     set status = 'EXPIRED', updated_at = now()
   where status = 'HOLD' and hold_expires_at < now();
  perform public.bubatrent_release_unverified_deposits();
  update public.bubatrent_booking_bookings
     set status = 'CANCELLED', updated_at = now()
   where status = 'HOLD' and user_id = v_uid;

  v_days := p_return - p_pickup;
  v_quote := public.bubatrent_rental_quote(v_car.id, v_days);
  v_total := (v_quote->>'total')::numeric;

  begin
    insert into public.bubatrent_booking_bookings (
      car_id, user_id, pickup_date, return_date, total_price, deposit_amount,
      status, hold_expires_at, fleet_group_id, long_rental_discount
    ) values (
      v_car.id, v_uid, p_pickup, p_return, v_total, greatest(100, ceil(v_total * 0.3)),
      'HOLD', now() + interval '10 minutes', v_car.fleet_group_id,
      (v_quote->>'long_discount')::numeric
    )
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'Sorry, this car was just booked for those dates. Please choose different dates.'
      using errcode = 'P0001';
  end;

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Book for Customer: long-rental rates and an agreed price
-- ---------------------------------------------------------------------
drop function if exists public.bubatrent_admin_create_booking(uuid, uuid, date, date, numeric, text, text, boolean, text);

create or replace function public.bubatrent_admin_create_booking(
  p_customer_id uuid,
  p_car_id uuid,
  p_pickup date,
  p_return date,
  p_deposit numeric,
  p_status text,
  p_receipt_path text default null,
  p_use_credit boolean default false,
  p_notes text default null,
  p_agreed_total numeric default null,
  p_price_note text default null
)
returns public.bubatrent_booking_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_receipt text := nullif(trim(coalesce(p_receipt_path, '')), '');
  v_price_note text := nullif(trim(coalesce(p_price_note, '')), '');
  v_car public.bubatrent_booking_cars;
  v_cust public.bubatrent_booking_profiles;
  v_quote jsonb;
  v_list numeric;
  v_total numeric;
  v_applied numeric := 0;
  v_due numeric;
  v_verified boolean;
  v_booking public.bubatrent_booking_bookings;
begin
  if not public.bubatrent_is_admin() then
    raise exception 'Not authorized: admin role required' using errcode = '42501';
  end if;

  select * into v_car from public.bubatrent_booking_cars where id = p_car_id;
  if not found or not public.bubatrent_can_access_fleet(v_car.fleet_group_id) then
    raise exception 'Car not found.' using errcode = 'P0002';
  end if;
  if v_car.is_available is false then
    raise exception 'This car is marked unavailable.' using errcode = '22023';
  end if;

  select * into v_cust from public.bubatrent_booking_profiles where id = p_customer_id for update;
  if not found then
    raise exception 'Customer not found.' using errcode = 'P0002';
  end if;
  if not coalesce(v_cust.is_verified, false) then
    raise exception 'Verify this customer first: check their IC and licence on the Customers page.'
      using errcode = '22023';
  end if;
  if v_cust.licence_expiry is not null and v_cust.licence_expiry < v_today then
    raise exception 'This customer''s driving licence has expired. Update it on the Customers page first.'
      using errcode = '22023';
  end if;

  if p_status is null or p_status not in ('DEPOSIT_PAID', 'CONFIRMED') then
    raise exception 'Initial status must be Deposit Paid or Confirmed.' using errcode = '22023';
  end if;
  if p_pickup is null or p_return is null or p_return <= p_pickup then
    raise exception 'Return date must be after the pick-up date.' using errcode = '22023';
  end if;
  if p_pickup < v_today then
    raise exception 'Pick-up date cannot be in the past.' using errcode = '22023';
  end if;
  if p_deposit is null or p_deposit < 100 then
    raise exception 'The deposit must be at least RM100.' using errcode = '22023';
  end if;
  if v_receipt is not null and v_receipt not like 'receipts/%' then
    raise exception 'Invalid receipt path.' using errcode = '22023';
  end if;

  v_quote := public.bubatrent_rental_quote(v_car.id, p_return - p_pickup);
  v_list := (v_quote->>'total')::numeric;
  v_total := coalesce(round(p_agreed_total, 2), v_list);
  if v_total < 0 then
    raise exception 'The agreed price can''t be below RM0.' using errcode = '22023';
  end if;
  if v_total <> v_list and v_price_note is null then
    raise exception 'Give a reason for the agreed price.' using errcode = '22023';
  end if;

  -- Free dates held by abandoned checkouts and by deposits not verified in time
  update public.bubatrent_booking_bookings
     set status = 'EXPIRED', updated_at = now()
   where status = 'HOLD' and hold_expires_at < now();
  perform public.bubatrent_release_unverified_deposits();

  if coalesce(p_use_credit, false) then
    v_applied := least(greatest(coalesce(v_cust.deposit_credit, 0), 0), p_deposit);
  end if;
  v_due := p_deposit - v_applied;
  -- Confirmed means staff have the deposit; credit covering all of it needs no check.
  v_verified := p_status = 'CONFIRMED' or v_due = 0;

  begin
    insert into public.bubatrent_booking_bookings (
      car_id, user_id, pickup_date, return_date, total_price, deposit_amount, status,
      fleet_group_id, customer_name, customer_email, customer_phone, notes,
      deposit_receipt_path, deposit_status, credit_applied, full_payment_amount,
      long_rental_discount
    ) values (
      v_car.id, v_cust.id, p_pickup, p_return, v_total, p_deposit, p_status,
      v_car.fleet_group_id,
      coalesce(v_cust.display_name, ''),
      case when v_cust.email like '%@bubatrent.local' then '' else coalesce(v_cust.email, '') end,
      coalesce(v_cust.phone, ''),
      trim(coalesce(p_notes, '')),
      v_receipt,
      case when v_verified then 'verified' when v_receipt is not null then 'uploaded' else 'pending' end,
      v_applied,
      v_total,
      (v_quote->>'long_discount')::numeric
    )
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'Those dates overlap another booking for this car.' using errcode = '23P01';
  end;

  if v_total <> v_list then
    insert into public.bubatrent_booking_rental_changes (booking_id, kind, amount, note, created_by)
    values (v_booking.id, 'price', v_total - v_list, v_price_note, v_uid);
  end if;

  -- Deposit payment: completed when received, pending while a receipt waits
  -- to be checked. A cash deposit not yet received gets its record from
  -- Mark Deposit Received.
  if v_verified or v_receipt is not null then
    insert into public.bubatrent_booking_payments (
      booking_id, amount, payment_method, status, simulated, payment_type,
      receipt_path, reference_number, fleet_group_id
    ) values (
      v_booking.id, p_deposit,
      case when v_receipt is not null then 'bank_transfer' when v_due = 0 then 'credit' else 'cash' end,
      case when v_verified then 'completed' else 'pending' end,
      false, 'deposit', v_receipt,
      'ADMIN-' || upper(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint)),
      v_car.fleet_group_id
    );
  end if;

  if v_applied > 0 then
    update public.bubatrent_booking_profiles
       set deposit_credit = coalesce(deposit_credit, 0) - v_applied
     where id = v_cust.id;
    insert into public.bubatrent_booking_credit_transactions (
      user_id, booking_id, amount, type, description, fleet_group_id
    ) values (
      v_cust.id, v_booking.id, -v_applied, 'applied', 'Credit applied to booking deposit',
      v_car.fleet_group_id
    );
  end if;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (
    v_uid, 'ADMIN_CREATE_BOOKING', 'booking', v_booking.id,
    jsonb_build_object(
      'by', 'admin', 'customer_id', v_cust.id, 'car_id', v_car.id,
      'dates', p_pickup || ' → ' || p_return, 'status', p_status,
      'total', v_total, 'deposit', p_deposit, 'credit_applied', v_applied)
    || case when v_total <> v_list
         then jsonb_build_object('list_price', v_list, 'price_note', v_price_note)
         else '{}'::jsonb end
  );

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Changing a rental
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_admin_change_rental_price(
  p_booking_id uuid, p_new_total numeric, p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings := public.bubatrent_admin_lock_booking(p_booking_id);
  v_new numeric := round(p_new_total, 2);
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_refund numeric;
begin
  if v_booking.status not in ('DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'RETURNED') then
    raise exception 'The price can be changed once the deposit is paid.' using errcode = '22023';
  end if;
  if v_new is null or v_new < 0 then
    raise exception 'Enter the new rental price.' using errcode = '22023';
  end if;
  if v_new = v_booking.total_price then
    raise exception 'That is the current price.' using errcode = '22023';
  end if;
  if v_note is null then
    raise exception 'Give a reason for the new price (for example what was agreed).' using errcode = '22023';
  end if;

  insert into public.bubatrent_booking_rental_changes (booking_id, kind, amount, note, created_by)
  values (p_booking_id, 'price', v_new - v_booking.total_price, v_note, auth.uid());
  update public.bubatrent_booking_bookings set total_price = v_new where id = p_booking_id;
  v_refund := public.bubatrent_settle_rent(p_booking_id, 'Rental price lowered: ' || v_note);

  select * into v_booking from public.bubatrent_booking_bookings where id = p_booking_id;
  return jsonb_build_object('total', v_new, 'refund', v_refund,
    'refund_by_hand', v_refund > 0 and v_booking.user_id is null,
    'rent_due', public.bubatrent_booking_rent_due(v_booking));
end;
$$;

create or replace function public.bubatrent_admin_extend_rental(
  p_booking_id uuid, p_new_return date, p_extra numeric default null, p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings := public.bubatrent_admin_lock_booking(p_booking_id);
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_default numeric;
  v_extra numeric;
  v_next date;
begin
  if v_booking.status not in ('CONFIRMED', 'PICKUP') then
    raise exception 'A rental can be extended once it is confirmed, until the car is returned.'
      using errcode = '22023';
  end if;
  if p_new_return is null or p_new_return <= v_booking.return_date then
    raise exception 'Choose a return date after %.', to_char(v_booking.return_date, 'DD Mon YYYY')
      using errcode = '22023';
  end if;
  if p_new_return - v_booking.pickup_date > 400 then
    raise exception 'That is too long for one booking.' using errcode = '22023';
  end if;

  -- The rental at the rate for its new length, less what it was at the old
  -- one (never below zero: 30 days at the monthly rate can cost less than 29)
  v_default := greatest(
    (public.bubatrent_rental_quote(v_booking.car_id, p_new_return - v_booking.pickup_date)->>'total')::numeric
    - (public.bubatrent_rental_quote(v_booking.car_id, v_booking.return_date - v_booking.pickup_date)->>'total')::numeric,
    0);
  v_extra := coalesce(round(p_extra, 2), v_default);
  if v_extra < 0 then
    raise exception 'The extra rent can''t be below RM0.' using errcode = '22023';
  end if;
  if v_extra <> v_default and v_note is null then
    raise exception 'Give a reason for the agreed extra rent.' using errcode = '22023';
  end if;

  -- Free dates held by abandoned checkouts and deposits not verified in time
  update public.bubatrent_booking_bookings
     set status = 'EXPIRED', updated_at = now()
   where status = 'HOLD' and hold_expires_at < now();
  perform public.bubatrent_release_unverified_deposits();

  select min(coalesce(b.car_since, b.pickup_date)) into v_next
    from public.bubatrent_booking_bookings b
   where b.car_id = v_booking.car_id and b.id <> v_booking.id
     and b.status in ('HOLD', 'DEPOSIT_PAID', 'CONFIRMED', 'PICKUP')
     and coalesce(b.car_since, b.pickup_date) > v_booking.return_date;
  if v_next is not null and v_next <= p_new_return then
    raise exception 'This car is booked from %. Extend to % at the latest, or replace the car.',
      to_char(v_next, 'DD Mon YYYY'), to_char(v_next - 1, 'DD Mon YYYY') using errcode = '22023';
  end if;

  begin
    update public.bubatrent_booking_bookings
       set return_date = p_new_return, total_price = total_price + v_extra
     where id = p_booking_id;
  exception when exclusion_violation then
    raise exception 'Those dates overlap another booking for this car.' using errcode = '23P01';
  end;

  insert into public.bubatrent_booking_rental_changes (
    booking_id, kind, amount, old_return, new_return, note, created_by
  ) values (
    p_booking_id, 'extension', v_extra, v_booking.return_date, p_new_return, v_note, auth.uid()
  );
  perform public.bubatrent_settle_rent(p_booking_id, 'Rental extended');

  select * into v_booking from public.bubatrent_booking_bookings where id = p_booking_id;
  return jsonb_build_object('extra', v_extra, 'rent_due', public.bubatrent_booking_rent_due(v_booking));
end;
$$;

create or replace function public.bubatrent_admin_end_rental_early(
  p_booking_id uuid, p_new_return date, p_reason text,
  p_reduction numeric default null, p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings := public.bubatrent_admin_lock_booking(p_booking_id);
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_booked integer := v_booking.return_date - v_booking.pickup_date;
  v_unused integer;
  v_unused_rent numeric;
  v_penalty numeric;
  v_default numeric;
  v_reduction numeric;
  v_refund numeric;
begin
  if v_booking.status not in ('CONFIRMED', 'PICKUP', 'RETURNED') then
    raise exception 'A rental can be ended early once it is confirmed.' using errcode = '22023';
  end if;
  if p_reason is null or p_reason not in ('customer', 'breakdown') then
    raise exception 'Choose why the rental ends early.' using errcode = '22023';
  end if;
  if p_new_return is null or p_new_return >= v_booking.return_date then
    raise exception 'Choose a date before the booked return date (%).',
      to_char(v_booking.return_date, 'DD Mon YYYY') using errcode = '22023';
  end if;
  if p_new_return <= v_booking.pickup_date then
    raise exception 'The rental must last at least one day; to stop it before that, cancel it.'
      using errcode = '22023';
  end if;
  if v_booking.car_since is not null and p_new_return < v_booking.car_since then
    raise exception 'The replacement car started on %; choose that day or later.',
      to_char(v_booking.car_since, 'DD Mon YYYY') using errcode = '22023';
  end if;

  -- The unused days at what this rental actually cost per day; the customer
  -- choosing to stop pays the agreement's 25% penalty on the rental
  v_unused := v_booking.return_date - p_new_return;
  v_unused_rent := round(v_booking.total_price * v_unused / v_booked, 2);
  v_penalty := case when p_reason = 'customer' then round(v_booking.total_price * 0.25, 2) else 0 end;
  v_default := greatest(v_unused_rent - v_penalty, 0);
  v_reduction := coalesce(round(p_reduction, 2), v_default);
  if v_reduction < 0 or v_reduction > v_unused_rent then
    raise exception 'The amount taken off can be RM0 to RM% (the unused days).',
      to_char(v_unused_rent, 'FM999999990.00') using errcode = '22023';
  end if;
  if v_reduction <> v_default and v_note is null then
    raise exception 'Give a reason for changing the amount taken off.' using errcode = '22023';
  end if;

  update public.bubatrent_booking_bookings
     set return_date = p_new_return, total_price = total_price - v_reduction
   where id = p_booking_id;
  insert into public.bubatrent_booking_rental_changes (
    booking_id, kind, amount, old_return, new_return, reason, penalty, note, created_by
  ) values (
    p_booking_id, 'early_return', -v_reduction, v_booking.return_date, p_new_return, p_reason,
    v_unused_rent - v_reduction, v_note, auth.uid()
  );
  v_refund := public.bubatrent_settle_rent(p_booking_id,
    case when p_reason = 'breakdown' then 'Rental ended early (breakdown): unused days'
         else 'Rental ended early: unused days less the penalty' end);

  select * into v_booking from public.bubatrent_booking_bookings where id = p_booking_id;
  return jsonb_build_object(
    'unused_days', v_unused, 'unused_rent', v_unused_rent, 'reduction', v_reduction,
    'kept', v_unused_rent - v_reduction, 'refund', v_refund,
    'refund_by_hand', v_refund > 0 and v_booking.user_id is null,
    'rent_due', public.bubatrent_booking_rent_due(v_booking));
end;
$$;

create or replace function public.bubatrent_admin_replace_car(
  p_booking_id uuid, p_car_id uuid, p_from date default null, p_note text default null,
  p_old_car_unavailable boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings := public.bubatrent_admin_lock_booking(p_booking_id);
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_old public.bubatrent_booking_cars;
  v_new public.bubatrent_booking_cars;
  v_from date;
begin
  if v_booking.status not in ('CONFIRMED', 'PICKUP') then
    raise exception 'A car can be replaced once the booking is confirmed, until it is returned.'
      using errcode = '22023';
  end if;
  select * into v_old from public.bubatrent_booking_cars where id = v_booking.car_id;
  select * into v_new from public.bubatrent_booking_cars where id = p_car_id;
  if not found or v_new.fleet_group_id is distinct from v_booking.fleet_group_id then
    raise exception 'Choose a car from this fleet.' using errcode = '22023';
  end if;
  if v_new.id = v_booking.car_id then
    raise exception 'That is the car on this booking now.' using errcode = '22023';
  end if;
  if v_new.is_available is false then
    raise exception 'That car is marked unavailable.' using errcode = '22023';
  end if;

  -- Before pickup the whole rental moves; after pickup, from the given day
  v_from := case when v_booking.status = 'CONFIRMED' then v_booking.pickup_date
                 else coalesce(p_from, v_today) end;
  if v_from < coalesce(v_booking.car_since, v_booking.pickup_date) or v_from > v_booking.return_date then
    raise exception 'Choose a day between % and %.',
      to_char(coalesce(v_booking.car_since, v_booking.pickup_date), 'DD Mon YYYY'),
      to_char(v_booking.return_date, 'DD Mon YYYY') using errcode = '22023';
  end if;

  update public.bubatrent_booking_bookings
     set status = 'EXPIRED', updated_at = now()
   where status = 'HOLD' and hold_expires_at < now();
  perform public.bubatrent_release_unverified_deposits();

  begin
    update public.bubatrent_booking_bookings
       set car_id = v_new.id,
           car_since = case when v_from > pickup_date then v_from end
     where id = p_booking_id;
  exception when exclusion_violation then
    raise exception 'That car is booked between % and %. Choose another car.',
      to_char(v_from, 'DD Mon YYYY'), to_char(v_booking.return_date, 'DD Mon YYYY')
      using errcode = '23P01';
  end;

  insert into public.bubatrent_booking_rental_changes (
    booking_id, kind, from_car_id, to_car_id, change_date, note, created_by
  ) values (
    p_booking_id, 'car_change', v_old.id, v_new.id, v_from, v_note, auth.uid()
  );
  if coalesce(p_old_car_unavailable, false) then
    update public.bubatrent_booking_cars set is_available = false where id = v_old.id;
  end if;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (auth.uid(), 'REPLACE_CAR', 'booking', p_booking_id,
    jsonb_build_object('from_car', v_old.name, 'from_plate', v_old.plate_number,
                       'to_car', v_new.name, 'to_plate', v_new.plate_number,
                       'from_date', v_from, 'note', v_note,
                       'old_car_unavailable', coalesce(p_old_car_unavailable, false), 'by', 'admin'));

  return jsonb_build_object('from_date', v_from);
end;
$$;

revoke all on function public.bubatrent_admin_create_booking(uuid, uuid, date, date, numeric, text, text, boolean, text, numeric, text) from public, anon;
revoke all on function public.bubatrent_admin_change_rental_price(uuid, numeric, text) from public, anon;
revoke all on function public.bubatrent_admin_extend_rental(uuid, date, numeric, text) from public, anon;
revoke all on function public.bubatrent_admin_end_rental_early(uuid, date, text, numeric, text) from public, anon;
revoke all on function public.bubatrent_admin_replace_car(uuid, uuid, date, text, boolean) from public, anon;
grant execute on function public.bubatrent_admin_create_booking(uuid, uuid, date, date, numeric, text, text, boolean, text, numeric, text) to authenticated;
grant execute on function public.bubatrent_admin_change_rental_price(uuid, numeric, text) to authenticated;
grant execute on function public.bubatrent_admin_extend_rental(uuid, date, numeric, text) to authenticated;
grant execute on function public.bubatrent_admin_end_rental_early(uuid, date, text, numeric, text) to authenticated;
grant execute on function public.bubatrent_admin_replace_car(uuid, uuid, date, text, boolean) to authenticated;

commit;
