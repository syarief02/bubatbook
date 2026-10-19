-- =====================================================================
-- Customers' bank details, for deposit refunds (2026-10-19)
--
-- Deposits go back to the customer as credit, and staff refund credit by
-- bank transfer, but the site never asked for a bank account.
--
-- Now:
--   * Profiles have bank_name, bank_account_number and
--     bank_account_holder: all three or none. The account number is
--     stored as 6 to 20 digits (spaces and dashes are removed).
--     bank_details_updated_at is stamped by the database.
--   * Customers give them when they verify their account and can change
--     them on their profile; staff can add them for counter customers
--     (optional there). Every change is in the audit log
--     (BANK_DETAILS_CHANGED, with the last 4 digits only).
--   * bubatrent_create_hold_booking: online bookings need bank details,
--     so already-verified customers add them once before their next
--     booking. Counter bookings (bubatrent_admin_create_booking) don't.
--
-- Deploy order: run before the frontend ships.
-- =====================================================================

begin;

alter table public.bubatrent_booking_profiles
  add column if not exists bank_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_account_holder text,
  add column if not exists bank_details_updated_at timestamptz;

comment on column public.bubatrent_booking_profiles.bank_account_number is
  'Account for deposit refunds: digits only. Set with bank_name and bank_account_holder (all or none).';
comment on column public.bubatrent_booking_profiles.bank_details_updated_at is
  'When the bank details last changed (set by the database).';

alter table public.bubatrent_booking_profiles
  drop constraint if exists bubatrent_profile_bank_details_complete,
  drop constraint if exists bubatrent_profile_bank_account_number_format,
  drop constraint if exists bubatrent_profile_bank_text_length;
alter table public.bubatrent_booking_profiles
  add constraint bubatrent_profile_bank_details_complete
    check (num_nulls(bank_name, bank_account_number, bank_account_holder) in (0, 3)),
  add constraint bubatrent_profile_bank_account_number_format
    check (bank_account_number ~ '^[0-9]{6,20}$'),
  add constraint bubatrent_profile_bank_text_length
    check (char_length(bank_name) <= 100 and char_length(bank_account_holder) <= 150);

-- Tidy what was typed (blank means none) and stamp when it changed
create or replace function public.bubatrent_tidy_bank_details()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.bank_name := nullif(btrim(regexp_replace(coalesce(new.bank_name, ''), '\s+', ' ', 'g')), '');
  new.bank_account_holder :=
    nullif(btrim(regexp_replace(coalesce(new.bank_account_holder, ''), '\s+', ' ', 'g')), '');
  new.bank_account_number := nullif(regexp_replace(coalesce(new.bank_account_number, ''), '[\s-]', '', 'g'), '');

  if tg_op = 'INSERT' then
    new.bank_details_updated_at := case when new.bank_account_number is not null then now() end;
  elsif (new.bank_name, new.bank_account_number, new.bank_account_holder)
        is distinct from (old.bank_name, old.bank_account_number, old.bank_account_holder) then
    new.bank_details_updated_at := now();
  else
    new.bank_details_updated_at := old.bank_details_updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists bubatrent_tidy_bank_details on public.bubatrent_booking_profiles;
create trigger bubatrent_tidy_bank_details
  before insert or update on public.bubatrent_booking_profiles
  for each row execute function public.bubatrent_tidy_bank_details();

-- Audit every change; customers can't write audit rows themselves, so this
-- runs as the owner. Only the last 4 digits go in the log.
create or replace function public.bubatrent_audit_bank_details()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'INSERT' and new.bank_account_number is null then
    return null;
  end if;
  if tg_op = 'UPDATE'
     and (new.bank_name, new.bank_account_number, new.bank_account_holder)
         is not distinct from (old.bank_name, old.bank_account_number, old.bank_account_holder) then
    return null;
  end if;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (
    auth.uid(), 'BANK_DETAILS_CHANGED', 'profile', new.id,
    jsonb_build_object(
      'by', case when auth.uid() is null then 'system'
                 when auth.uid() = new.id then 'customer'
                 else 'admin' end,
      'bank', new.bank_name,
      'holder', new.bank_account_holder,
      'account_ending', right(new.bank_account_number, 4),
      'previous_bank', case when tg_op = 'UPDATE' then old.bank_name end,
      'previous_account_ending', case when tg_op = 'UPDATE' then right(old.bank_account_number, 4) end)
  );
  return null;
end;
$$;

drop trigger if exists bubatrent_audit_bank_details on public.bubatrent_booking_profiles;
create trigger bubatrent_audit_bank_details
  after insert or update on public.bubatrent_booking_profiles
  for each row execute function public.bubatrent_audit_bank_details();

-- Online bookings need the account the deposit is refunded to
create or replace function public.bubatrent_create_hold_booking(p_car_id uuid, p_pickup date, p_return date)
returns public.bubatrent_booking_bookings
language plpgsql
security definer
set search_path to ''
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
  if v_profile.bank_account_number is null then
    raise exception 'Please add your bank details in your profile before booking.'
      using errcode = '42501';
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

commit;
