-- =====================================================================
-- Credit belongs to a fleet (2026-10-22)
--
-- A returned deposit kept as credit, or credit an admin adds, is money
-- that fleet owes the customer. The owner's rule: what a customer owes a
-- fleet, or a fleet owes a customer, belongs to that fleet; another fleet
-- has no responsibility for it. Until now credit was one balance per
-- customer (profiles.deposit_credit), so credit from one fleet's deposit
-- could pay a deposit at another.
--
-- Every credit ledger entry already carries its fleet. Now:
--   * bubatrent_fleet_credit(user, fleet): the customer's credit with a
--     fleet, the sum of that fleet's ledger entries.
--   * Credit is spent only with the fleet it is with: the customer's own
--     deposit (bubatrent_submit_booking_deposit) and Book for Customer
--     (bubatrent_admin_create_booking) apply at most that fleet's credit.
--   * Adding or deducting credit (bubatrent_admin_adjust_credit) needs a
--     fleet and can't deduct more than the customer has with it; removing
--     a workshop payment can't take back credit already used there.
--   * bubatrent_my_fleet_credits(): a customer's credit by fleet.
-- profiles.deposit_credit stays the total across fleets.
--
-- Nobody holds credit today (all balances are 0), so nothing moves.
-- The function bodies below are the live ones with only the credit
-- checks changed.
--
-- Deploy order: run before the frontend ships.
-- =====================================================================

begin;

create or replace function public.bubatrent_fleet_credit(p_user_id uuid, p_fleet_group_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(t.amount), 0)
    from public.bubatrent_booking_credit_transactions t
   where t.user_id = p_user_id and t.fleet_group_id = p_fleet_group_id;
$$;

revoke all on function public.bubatrent_fleet_credit(uuid, uuid) from public, anon, authenticated;

-- The signed-in customer's credit, by fleet (only fleets they have credit with)
create or replace function public.bubatrent_my_fleet_credits()
returns table (fleet_group_id uuid, fleet_name text, balance numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select t.fleet_group_id, g.name, sum(t.amount)
    from public.bubatrent_booking_credit_transactions t
    join public.bubatrent_booking_fleet_groups g on g.id = t.fleet_group_id
   where t.user_id = auth.uid()
   group by t.fleet_group_id, g.name
  having sum(t.amount) <> 0
   order by g.name;
$$;

revoke all on function public.bubatrent_my_fleet_credits() from public, anon;
grant execute on function public.bubatrent_my_fleet_credits() to authenticated;

CREATE OR REPLACE FUNCTION public.bubatrent_admin_adjust_credit(p_user_id uuid, p_amount numeric, p_description text DEFAULT NULL::text, p_fleet_group_id uuid DEFAULT NULL::uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_amount numeric := round(p_amount, 2);
  v_balance numeric;
  v_fleet_balance numeric;
begin
  if not public.bubatrent_is_admin() then
    raise exception 'Not authorized: admin role required' using errcode = '42501';
  end if;
  if v_amount is null or v_amount = 0 then
    raise exception 'Enter a valid amount.' using errcode = '22023';
  end if;
  -- Credit belongs to the fleet that owes it, so it always has one.
  if p_fleet_group_id is null then
    raise exception 'Choose the fleet this credit is with.' using errcode = '22023';
  end if;
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
  -- Only what this customer has with this fleet can be deducted
  v_fleet_balance := public.bubatrent_fleet_credit(p_user_id, p_fleet_group_id);
  if v_fleet_balance + v_amount < 0 then
    raise exception 'Cannot deduct more than the customer''s RM% credit with this fleet.',
      to_char(greatest(v_fleet_balance, 0), 'FM999999990.00') using errcode = '22023';
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
$function$;

CREATE OR REPLACE FUNCTION public.bubatrent_admin_create_booking(p_customer_id uuid, p_car_id uuid, p_pickup date, p_return date, p_deposit numeric, p_status text, p_receipt_path text DEFAULT NULL::text, p_use_credit boolean DEFAULT false, p_notes text DEFAULT NULL::text, p_agreed_total numeric DEFAULT NULL::numeric, p_price_note text DEFAULT NULL::text)
 RETURNS bubatrent_booking_bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    -- Only credit the customer has with this car's fleet
    v_applied := least(greatest(least(coalesce(v_cust.deposit_credit, 0),
                                      public.bubatrent_fleet_credit(v_cust.id, v_car.fleet_group_id)), 0),
                       p_deposit);
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
$function$;

CREATE OR REPLACE FUNCTION public.bubatrent_admin_remove_workshop_payment(p_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    if v_balance < v_payment.to_credit
       or public.bubatrent_fleet_credit(v_booking.user_id, v_booking.fleet_group_id) < v_payment.to_credit then
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
$function$;

CREATE OR REPLACE FUNCTION public.bubatrent_submit_booking_deposit(p_booking_id uuid, p_receipt_path text)
 RETURNS bubatrent_booking_bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_receipt text := nullif(trim(coalesce(p_receipt_path, '')), '');
  v_booking public.bubatrent_booking_bookings;
  v_credit numeric;
  v_applied numeric;
  v_due numeric;
begin
  if v_uid is null then
    raise exception 'Please log in again.' using errcode = '28000';
  end if;

  select * into v_booking from public.bubatrent_booking_bookings
   where id = p_booking_id and user_id = v_uid
   for update;
  if not found then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;
  if v_booking.status <> 'HOLD' then
    raise exception 'This booking is no longer waiting for a deposit.' using errcode = '22023';
  end if;
  if v_booking.hold_expires_at is not null and v_booking.hold_expires_at < now() then
    raise exception 'Your hold has expired. Please start over.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.bubatrent_booking_rental_agreements a where a.booking_id = p_booking_id
  ) then
    raise exception 'Please sign the rental agreement before paying the deposit.'
      using errcode = '22023';
  end if;
  if v_receipt is not null and v_receipt not like 'receipts/' || p_booking_id::text || '/%' then
    raise exception 'Invalid receipt path.' using errcode = '22023';
  end if;

  select coalesce(deposit_credit, 0) into v_credit
    from public.bubatrent_booking_profiles where id = v_uid
    for update;
  -- Only credit the customer has with this booking's fleet
  v_applied := least(greatest(least(v_credit,
                                    public.bubatrent_fleet_credit(v_uid, v_booking.fleet_group_id)), 0),
                     v_booking.deposit_amount);
  v_due := v_booking.deposit_amount - v_applied;

  if v_due > 0 and v_receipt is null then
    raise exception 'Please upload your payment receipt.' using errcode = '22023';
  end if;

  update public.bubatrent_booking_bookings
     set status = 'DEPOSIT_PAID',
         deposit_status = case when v_due > 0 then 'uploaded' else 'verified' end,
         deposit_receipt_path = v_receipt,
         credit_applied = v_applied,
         hold_expires_at = null,
         deposit_review_due_at = case when v_due > 0 then now() + interval '48 hours' end,
         full_payment_amount = v_booking.total_price,
         updated_at = now()
   where id = p_booking_id
  returning * into v_booking;

  insert into public.bubatrent_booking_payments (
    booking_id, amount, payment_method, status, simulated, payment_type,
    receipt_path, reference_number, fleet_group_id
  ) values (
    p_booking_id, v_booking.deposit_amount, 'bank_transfer',
    case when v_due > 0 then 'pending' else 'completed' end,
    false, 'deposit', v_receipt,
    'DEP-' || upper(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint)),
    v_booking.fleet_group_id
  );

  if v_applied > 0 then
    update public.bubatrent_booking_profiles
       set deposit_credit = v_credit - v_applied
     where id = v_uid;
    insert into public.bubatrent_booking_credit_transactions (
      user_id, booking_id, amount, type, description, fleet_group_id
    ) values (
      v_uid, p_booking_id, -v_applied, 'applied', 'Credit applied to booking deposit',
      v_booking.fleet_group_id
    );
  end if;

  return v_booking;
end;
$function$;

commit;
