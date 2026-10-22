-- =====================================================================
-- The Counter: record any rental in one step (2026-10-22)
--
-- The owner wants a POS-style screen to record rentals: new orders, past
-- rentals that are already paid, and deals made on WhatsApp, including
-- ones where the customer still has the car. Book for Customer only takes
-- future bookings for verified customers with an account, so past and
-- WhatsApp rentals had to be imported by script. Now (decided with the
-- owner):
--   * bubatrent_admin_record_rental: one rental, booked (upcoming), on
--     rent now, or returned, with what was paid. A name and phone are
--     enough; a customer account is optional. An upcoming booking still
--     needs a verified customer, as online. Past dates are fine; dates
--     that overlap another rental of the car are refused. For a returned
--     rental with a deposit, staff say what happened to it: refunded,
--     kept as credit (with this fleet, account needed), or still held.
--   * bubatrent_admin_record_rent_payment: rent received later (cash or
--     transfer, part or all).
--   * bubatrent_admin_deposit_refunded: a deposit staff refunded by hand
--     on a rental without a customer account (with an account it goes to
--     their credit when the car comes back, as before).
--   * Moving a car to another fleet takes its car documents along, so
--     the new fleet gets the expiry alerts.
-- Payments are recorded as payments, so Sales counts them.
--
-- Deploy order: run before the frontend ships. Nothing existing changes.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. A car's documents follow it to another fleet
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_move_car_documents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bubatrent_booking_car_documents
     set fleet_group_id = new.fleet_group_id
   where car_id = new.id
     and fleet_group_id is distinct from new.fleet_group_id;
  return new;
end;
$$;

drop trigger if exists bubatrent_move_car_documents on public.bubatrent_booking_cars;
create trigger bubatrent_move_car_documents
  after update of fleet_group_id on public.bubatrent_booking_cars
  for each row when (new.fleet_group_id is distinct from old.fleet_group_id)
  execute function public.bubatrent_move_car_documents();

-- ---------------------------------------------------------------------
-- 2. Record a rental
-- ---------------------------------------------------------------------
-- The receipt, if any, is uploaded first to receipts/<p_id>/.
create or replace function public.bubatrent_admin_record_rental(
  p_id uuid,
  p_car_id uuid,
  p_status text,                 -- CONFIRMED (booked), PICKUP (on rent), RETURNED
  p_pickup date,
  p_return date,
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_total numeric default null,  -- the agreed rent; null = the car's price for the dates
  p_deposit numeric default 0,   -- deposit received
  p_paid numeric default 0,      -- rent received so far
  p_method text default 'cash',  -- cash or bank_transfer
  p_paid_on date default null,
  p_receipt_path text default null,
  p_actual_return date default null,
  p_deposit_outcome text default null,  -- returned with a deposit: refunded, credit or held
  p_notes text default null
)
returns public.bubatrent_booking_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_car public.bubatrent_booking_cars;
  v_cust public.bubatrent_booking_profiles;
  v_name text := nullif(trim(coalesce(p_customer_name, '')), '');
  v_phone text := nullif(trim(coalesce(p_customer_phone, '')), '');
  v_days integer := p_return - p_pickup;
  v_total numeric;
  v_deposit numeric := round(coalesce(p_deposit, 0), 2);
  v_paid numeric := round(coalesce(p_paid, 0), 2);
  v_method text := coalesce(nullif(p_method, ''), 'cash');
  v_receipt text := nullif(trim(coalesce(p_receipt_path, '')), '');
  v_end date;
  v_paid_at timestamptz;
  v_clash record;
  v_booking public.bubatrent_booking_bookings;
  v_notes text;
begin
  if not public.bubatrent_is_admin() then
    raise exception 'Not authorized: admin role required' using errcode = '42501';
  end if;
  select * into v_car from public.bubatrent_booking_cars where id = p_car_id;
  if not found or not public.bubatrent_can_access_fleet(v_car.fleet_group_id) then
    raise exception 'Car not found.' using errcode = 'P0002';
  end if;
  if p_id is null or exists (select 1 from public.bubatrent_booking_bookings b where b.id = p_id) then
    raise exception 'This rental was already saved. Reload the page.' using errcode = '22023';
  end if;
  if p_status is null or p_status not in ('CONFIRMED', 'PICKUP', 'RETURNED') then
    raise exception 'Choose booked, on rent or returned.' using errcode = '22023';
  end if;

  -- The customer: an account, or a name and phone
  if p_customer_id is not null then
    select * into v_cust from public.bubatrent_booking_profiles where id = p_customer_id;
    if not found then
      raise exception 'Customer not found.' using errcode = 'P0002';
    end if;
    v_name := coalesce(v_name, nullif(trim(v_cust.display_name), ''));
    v_phone := coalesce(v_phone, nullif(trim(v_cust.phone), ''));
  end if;
  if v_name is null then
    raise exception 'Enter the customer''s name.' using errcode = '22023';
  end if;
  if v_phone is null or length(regexp_replace(v_phone, '\D', '', 'g')) < 9 then
    raise exception 'Enter the customer''s phone number.' using errcode = '22023';
  end if;

  -- Dates, against today
  if p_pickup is null or p_return is null or v_days < 1 then
    raise exception 'The return date must be after the pick-up date.' using errcode = '22023';
  end if;
  if v_days > 366 then
    raise exception 'Check the dates: that is more than a year.' using errcode = '22023';
  end if;
  if p_pickup < v_today - interval '3 years' then
    raise exception 'Check the pick-up date: it is more than 3 years ago.' using errcode = '22023';
  end if;
  if p_status = 'CONFIRMED' then
    if p_pickup < v_today then
      raise exception 'A booking that has started is on rent: choose "On rent".' using errcode = '22023';
    end if;
    if not v_car.is_available then
      raise exception 'This car is marked unavailable.' using errcode = '22023';
    end if;
    -- Upcoming bookings follow the online rule
    if p_customer_id is null or not coalesce(v_cust.is_verified, false) then
      raise exception 'An upcoming booking needs a verified customer: choose their account (or verify them first).'
        using errcode = '22023';
    end if;
    if v_cust.licence_expiry is not null and v_cust.licence_expiry < p_pickup then
      raise exception 'This customer''s driving licence will have expired by the pick-up date.'
        using errcode = '22023';
    end if;
  elsif p_pickup > v_today then
    raise exception 'The pick-up date is in the future: choose "Booked".' using errcode = '22023';
  end if;
  v_end := case when p_status = 'RETURNED' then coalesce(p_actual_return, p_return) else p_return end;
  if p_status = 'RETURNED' then
    if v_end < p_pickup then
      raise exception 'The car can''t come back before it was picked up.' using errcode = '22023';
    end if;
    if v_end > v_today then
      raise exception 'The return date is in the future: choose "On rent".' using errcode = '22023';
    end if;
  end if;

  -- Another rental of this car on these dates
  select b.pickup_date, coalesce(case when b.status = 'RETURNED' then b.actual_return_date end, b.return_date) as ends,
         coalesce(b.customer_name, 'a customer') as who
    into v_clash
    from public.bubatrent_booking_bookings b
   where b.car_id = p_car_id
     and (b.status in ('DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'RETURNED')
          or (b.status = 'HOLD' and b.hold_expires_at > now()))
     and b.pickup_date < v_end
     and coalesce(case when b.status = 'RETURNED' then b.actual_return_date end, b.return_date) > p_pickup
   order by b.pickup_date
   limit 1;
  if found then
    raise exception '% is already rented to % from % to %. Check the dates.',
      coalesce(v_car.plate_number, v_car.name), v_clash.who,
      to_char(v_clash.pickup_date, 'DD Mon YYYY'), to_char(v_clash.ends, 'DD Mon YYYY')
      using errcode = '22023';
  end if;

  -- Money
  v_total := round(coalesce(p_total, (public.bubatrent_rental_quote(p_car_id, v_days)->>'total')::numeric), 2);
  if v_total is null or v_total < 0 or v_total > 1000000 then
    raise exception 'Enter the rent agreed.' using errcode = '22023';
  end if;
  if v_deposit < 0 or v_deposit > 100000 then
    raise exception 'Enter a deposit between RM0 and RM100,000.' using errcode = '22023';
  end if;
  if v_paid < 0 then
    raise exception 'The rent paid can''t be below RM0.' using errcode = '22023';
  end if;
  if v_paid > v_total then
    raise exception 'The rent paid (RM%) is more than the rent (RM%).',
      to_char(v_paid, 'FM999999990.00'), to_char(v_total, 'FM999999990.00') using errcode = '22023';
  end if;
  if v_method not in ('cash', 'bank_transfer') then
    raise exception 'Choose cash or transfer.' using errcode = '22023';
  end if;
  if v_receipt is not null and v_receipt not like 'receipts/' || p_id::text || '/%' then
    raise exception 'Invalid receipt path.' using errcode = '22023';
  end if;
  if p_status = 'RETURNED' and v_deposit > 0 then
    if p_deposit_outcome is null or p_deposit_outcome not in ('refunded', 'credit', 'held') then
      raise exception 'Say what happened to the deposit: refunded, kept as credit, or still held.'
        using errcode = '22023';
    end if;
    if p_deposit_outcome = 'credit' and p_customer_id is null then
      raise exception 'Credit needs a customer account. Choose their account, or record the deposit as refunded.'
        using errcode = '22023';
    end if;
  end if;
  v_paid_at := (coalesce(p_paid_on, least(p_pickup, v_today))::timestamp + interval '12 hours')
               at time zone 'Asia/Kuala_Lumpur';

  v_notes := concat_ws(' ', nullif(trim(coalesce(p_notes, '')), ''),
    case when p_status = 'RETURNED' and v_deposit > 0 and p_deposit_outcome = 'refunded'
         then 'Deposit refunded.' end,
    'Recorded at the Counter.');

  insert into public.bubatrent_booking_bookings (
    id, car_id, user_id, customer_name, customer_phone, customer_email,
    pickup_date, return_date, actual_return_date, total_price, deposit_amount, status, notes,
    deposit_status, full_payment_status, full_payment_amount, full_payment_receipt_path,
    rent_paid, created_by_admin, fleet_group_id, deposit_on_hold, deposit_credited_at
  ) values (
    p_id, p_car_id, p_customer_id, v_name, v_phone, v_cust.email,
    p_pickup, p_return, case when p_status = 'RETURNED' then v_end end, v_total, v_deposit, p_status,
    v_notes,
    'verified', case when v_paid >= v_total then 'verified' else 'pending' end, v_total,
    case when v_paid > 0 then v_receipt end,
    v_paid, auth.uid(), v_car.fleet_group_id,
    p_status = 'RETURNED' and v_deposit > 0 and p_deposit_outcome = 'held',
    -- Settled already: refunded by hand, or (below) put to their credit; nothing to settle at RM0
    case when p_status = 'RETURNED' and (v_deposit = 0 or p_deposit_outcome = 'refunded') then now() end
  ) returning * into v_booking;

  if v_deposit > 0 then
    insert into public.bubatrent_booking_payments (
      booking_id, amount, payment_method, status, simulated, payment_type,
      receipt_path, reference_number, created_at, fleet_group_id
    ) values (
      p_id, v_deposit, v_method, 'completed', false, 'deposit', null,
      'DEP-' || upper(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint)),
      v_paid_at, v_car.fleet_group_id
    );
  end if;
  if v_paid > 0 then
    insert into public.bubatrent_booking_payments (
      booking_id, amount, payment_method, status, simulated, payment_type,
      receipt_path, reference_number, created_at, fleet_group_id
    ) values (
      p_id, v_paid, v_method, 'completed', false, 'full_payment', v_receipt,
      'FP-' || upper(to_hex((extract(epoch from clock_timestamp()) * 1000 + 1)::bigint)),
      v_paid_at, v_car.fleet_group_id
    );
  end if;

  if p_status = 'RETURNED' and v_deposit > 0 and p_deposit_outcome = 'credit' then
    perform public.bubatrent_give_back_booking_credit(v_booking, 'Deposit kept as credit (recorded at the Counter)');
    update public.bubatrent_booking_bookings set deposit_credited_at = now()
     where id = p_id returning * into v_booking;
  end if;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (auth.uid(), 'RECORD_RENTAL', 'booking', p_id,
    jsonb_build_object('car_id', p_car_id, 'plate_number', v_car.plate_number, 'status', p_status,
                       'customer', v_name, 'phone', v_phone, 'customer_id', p_customer_id,
                       'dates', p_pickup || ' to ' || p_return, 'total', v_total, 'paid', v_paid,
                       'deposit', v_deposit, 'deposit_outcome', p_deposit_outcome, 'by', 'counter'));

  return v_booking;
end;
$$;

revoke all on function public.bubatrent_admin_record_rental(
  uuid, uuid, text, date, date, uuid, text, text, numeric, numeric, numeric, text, date, text, date, text, text
) from public, anon;
grant execute on function public.bubatrent_admin_record_rental(
  uuid, uuid, text, date, date, uuid, text, text, numeric, numeric, numeric, text, date, text, date, text, text
) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Rent received later
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_admin_record_rent_payment(
  p_booking_id uuid,
  p_amount numeric,
  p_method text default 'cash',
  p_paid_on date default null,
  p_receipt_path text default null
)
returns public.bubatrent_booking_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings := public.bubatrent_admin_lock_booking(p_booking_id);
  v_amount numeric := round(p_amount, 2);
  v_due numeric := greatest(v_booking.total_price - v_booking.rent_paid, 0);
  v_method text := coalesce(nullif(p_method, ''), 'cash');
  v_receipt text := nullif(trim(coalesce(p_receipt_path, '')), '');
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  if v_booking.status not in ('DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'RETURNED') then
    raise exception 'This booking isn''t active.' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Enter the amount received.' using errcode = '22023';
  end if;
  if v_amount > v_due then
    raise exception 'That is more than the RM% rent still due.', to_char(v_due, 'FM999999990.00')
      using errcode = '22023';
  end if;
  if v_method not in ('cash', 'bank_transfer') then
    raise exception 'Choose cash or transfer.' using errcode = '22023';
  end if;
  if v_receipt is not null and v_receipt not like 'receipts/' || p_booking_id::text || '/%' then
    raise exception 'Invalid receipt path.' using errcode = '22023';
  end if;
  if p_paid_on is not null and p_paid_on > v_today then
    raise exception 'The payment date is in the future.' using errcode = '22023';
  end if;

  update public.bubatrent_booking_bookings
     set rent_paid = rent_paid + v_amount,
         full_payment_amount = total_price,
         full_payment_status = case when rent_paid + v_amount >= total_price then 'verified'
                                    else full_payment_status end,
         full_payment_receipt_path = coalesce(v_receipt, full_payment_receipt_path)
   where id = p_booking_id
  returning * into v_booking;

  insert into public.bubatrent_booking_payments (
    booking_id, amount, payment_method, status, simulated, payment_type,
    receipt_path, reference_number, created_at, fleet_group_id
  ) values (
    p_booking_id, v_amount, v_method, 'completed', false, 'full_payment', v_receipt,
    'FP-' || upper(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint)),
    case when p_paid_on is null then now()
         else (p_paid_on::timestamp + interval '12 hours') at time zone 'Asia/Kuala_Lumpur' end,
    v_booking.fleet_group_id
  );

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (auth.uid(), 'RECORD_RENT_PAYMENT', 'booking', p_booking_id,
    jsonb_build_object('amount', v_amount, 'method', v_method, 'paid_on', p_paid_on,
                       'rent_paid', v_booking.rent_paid, 'total', v_booking.total_price));

  return v_booking;
end;
$$;

revoke all on function public.bubatrent_admin_record_rent_payment(uuid, numeric, text, date, text) from public, anon;
grant execute on function public.bubatrent_admin_record_rent_payment(uuid, numeric, text, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. A deposit refunded by hand (rental without a customer account)
-- ---------------------------------------------------------------------
create or replace function public.bubatrent_admin_deposit_refunded(p_booking_id uuid, p_note text default null)
returns public.bubatrent_booking_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bubatrent_booking_bookings := public.bubatrent_admin_lock_booking(p_booking_id);
begin
  if v_booking.user_id is not null then
    raise exception 'This customer has an account: their deposit goes to their credit. Refund it from Customers (Deduct Credit).'
      using errcode = '22023';
  end if;
  if v_booking.status not in ('RETURNED', 'CANCELLED') then
    raise exception 'Mark the car returned first.' using errcode = '22023';
  end if;
  if v_booking.deposit_credited_at is not null then
    raise exception 'The deposit is already settled.' using errcode = '22023';
  end if;
  if v_booking.deposit_on_hold then
    raise exception 'The deposit is on hold: settle it first (Settle Deposit).' using errcode = '22023';
  end if;

  update public.bubatrent_booking_bookings
     set deposit_credited_at = now(),
         notes = concat_ws(' ', notes, 'Deposit refunded' ||
                   coalesce(': ' || nullif(trim(coalesce(p_note, '')), ''), '') || '.')
   where id = p_booking_id
  returning * into v_booking;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (auth.uid(), 'DEPOSIT_REFUNDED', 'booking', p_booking_id,
    jsonb_build_object('amount', v_booking.deposit_amount, 'note', nullif(trim(coalesce(p_note, '')), '')));

  return v_booking;
end;
$$;

revoke all on function public.bubatrent_admin_deposit_refunded(uuid, text) from public, anon;
grant execute on function public.bubatrent_admin_deposit_refunded(uuid, text) to authenticated;

commit;
