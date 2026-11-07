-- GDL (Goods Driving Licence) for commercial vehicles (8 Nov 2026)
--
-- Customers can add their GDL (expiry date + photo) when they verify, or later
-- through a verification update. It's optional, but a car marked
-- requires_gdl (the panel vans) can only be booked online by a customer whose
-- GDL is valid until the return date. Admin bookings and the Counter aren't
-- blocked: staff check the GDL in person.

begin;

alter table public.bubatrent_booking_profiles
  add column if not exists gdl_expiry date,
  add column if not exists gdl_file_path text;

alter table public.bubatrent_booking_verification_updates
  add column if not exists gdl_expiry date,
  add column if not exists gdl_file_path text;

alter table public.bubatrent_booking_cars
  add column if not exists requires_gdl boolean not null default false;

comment on column public.bubatrent_booking_profiles.gdl_expiry is
  'GDL (Goods Driving Licence) expiry; needed to book a car with requires_gdl';
comment on column public.bubatrent_booking_profiles.gdl_file_path is
  'Photo of the GDL in customer-documents';
comment on column public.bubatrent_booking_cars.requires_gdl is
  'Commercial vehicle: online bookings need a GDL valid until the return date';

-- The panel vans are commercial goods vehicles
update public.bubatrent_booking_cars set requires_gdl = true where name ilike '%panel van%';

CREATE OR REPLACE FUNCTION public.bubatrent_protect_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
    or new.gdl_license is distinct from old.gdl_license
    or new.gdl_expiry is distinct from old.gdl_expiry
    or new.gdl_file_path is distinct from old.gdl_file_path) then
    raise exception 'Verified identity details can only be changed through a verification update'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.bubatrent_check_verification_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_profile public.bubatrent_booking_profiles;
begin
  -- Runs as the owner (to read the profile); the role setting still holds
  -- the request's role.
  if coalesce(current_setting('role', true), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  new.status := 'pending';
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.rejection_reason := null;
  new.created_at := now();

  select * into v_profile from public.bubatrent_booking_profiles where id = new.user_id;
  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  if new.licence_expiry is null or new.licence_expiry < v_today then
    raise exception 'Enter a licence expiry date that hasn''t passed.' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(new.ic_number, '')), '') is null then
    raise exception 'IC number is required.' using errcode = '22023';
  end if;

  -- Photos: the customer's own uploads, or the ones already on the profile
  if new.ic_file_path is not null
     and new.ic_file_path is distinct from v_profile.ic_file_path
     and new.ic_file_path not like 'profiles/' || new.user_id::text || '/%' then
    raise exception 'Invalid IC file.' using errcode = '22023';
  end if;
  if new.licence_file_path is not null
     and new.licence_file_path is distinct from v_profile.licence_file_path
     and new.licence_file_path not like 'profiles/' || new.user_id::text || '/%' then
    raise exception 'Invalid licence file.' using errcode = '22023';
  end if;

  -- A new expiry date needs a photo of the new licence; a new IC number a new IC photo
  if new.licence_expiry is distinct from v_profile.licence_expiry
     and (new.licence_file_path is null or new.licence_file_path is not distinct from v_profile.licence_file_path) then
    raise exception 'Please upload a photo of your new driving licence.' using errcode = '22023';
  end if;
  if btrim(new.ic_number) is distinct from v_profile.ic_number
     and (new.ic_file_path is null or new.ic_file_path is not distinct from v_profile.ic_file_path) then
    raise exception 'Please upload a photo of your IC for the new IC number.' using errcode = '22023';
  end if;
  -- GDL (optional; needed for commercial vehicles): its expiry date and photo go together
  if new.gdl_file_path is not null
     and new.gdl_file_path is distinct from v_profile.gdl_file_path
     and new.gdl_file_path not like 'profiles/' || new.user_id::text || '/%' then
    raise exception 'Invalid GDL file.' using errcode = '22023';
  end if;
  if new.gdl_expiry is distinct from v_profile.gdl_expiry and new.gdl_expiry is not null then
    if new.gdl_expiry < v_today then
      raise exception 'Enter a GDL expiry date that hasn''t passed.' using errcode = '22023';
    end if;
    if new.gdl_file_path is null or new.gdl_file_path is not distinct from v_profile.gdl_file_path then
      raise exception 'Please upload a photo of your GDL.' using errcode = '22023';
    end if;
  end if;
  if new.gdl_file_path is distinct from v_profile.gdl_file_path
     and new.gdl_file_path is not null and new.gdl_expiry is null then
    raise exception 'Enter your GDL expiry date.' using errcode = '22023';
  end if;

  new.ic_number := btrim(new.ic_number);

  if exists (
    select 1 from public.bubatrent_booking_verification_updates
     where user_id = new.user_id and status = 'pending'
  ) then
    raise exception 'Your last update is still being reviewed.' using errcode = '23505';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.bubatrent_admin_review_verification_update(p_update_id uuid, p_approve boolean, p_reason text DEFAULT NULL::text)
 RETURNS bubatrent_booking_verification_updates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_update public.bubatrent_booking_verification_updates;
  v_profile public.bubatrent_booking_profiles;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_uid is null or not coalesce(public.bubatrent_is_admin(), false) then
    raise exception 'Only admins can review document updates.' using errcode = '42501';
  end if;
  if p_approve is null then
    raise exception 'Choose approve or reject.' using errcode = '22023';
  end if;

  select * into v_update from public.bubatrent_booking_verification_updates
   where id = p_update_id for update;
  if not found then
    raise exception 'Update not found.' using errcode = 'P0002';
  end if;
  if v_update.status <> 'pending' then
    raise exception 'This update was already reviewed.' using errcode = '22023';
  end if;
  select * into v_profile from public.bubatrent_booking_profiles where id = v_update.user_id for update;

  if p_approve then
    if v_update.licence_expiry is null or v_update.licence_expiry < v_today then
      raise exception 'The new licence has already expired. Reject it and ask for a valid one.'
        using errcode = '22023';
    end if;
    if v_update.gdl_expiry is distinct from v_profile.gdl_expiry and v_update.gdl_expiry < v_today then
      raise exception 'The new GDL has already expired. Reject it and ask for a valid one.'
        using errcode = '22023';
    end if;

    update public.bubatrent_booking_profiles
       set ic_number = coalesce(nullif(v_update.ic_number, ''), ic_number),
           licence_expiry = v_update.licence_expiry,
           ic_file_path = coalesce(v_update.ic_file_path, ic_file_path),
           licence_file_path = coalesce(v_update.licence_file_path, licence_file_path),
           gdl_expiry = coalesce(v_update.gdl_expiry, gdl_expiry),
           gdl_file_path = coalesce(v_update.gdl_file_path, gdl_file_path),
           address_line1 = coalesce(nullif(v_update.address_line1, ''), address_line1),
           address_line2 = case when nullif(v_update.address_line1, '') is not null
                                then nullif(v_update.address_line2, '') else address_line2 end,
           city = coalesce(nullif(v_update.city, ''), city),
           state = coalesce(nullif(v_update.state, ''), state),
           postcode = coalesce(nullif(v_update.postcode, ''), postcode),
           is_verified = true,
           verified_by = v_uid,
           verified_at = now()
     where id = v_update.user_id;

    update public.bubatrent_booking_verification_updates
       set status = 'approved', reviewed_by = v_uid, reviewed_at = now(), rejection_reason = null
     where id = p_update_id
    returning * into v_update;

    insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
    values (
      v_uid, 'APPROVE_VERIFICATION_UPDATE', 'profile', v_update.user_id,
      jsonb_build_object(
        'update_id', v_update.id,
        'licence_expiry_from', v_profile.licence_expiry,
        'licence_expiry_to', v_update.licence_expiry,
        'ic_number_changed', v_update.ic_number is distinct from v_profile.ic_number,
        'new_licence_photo', v_update.licence_file_path is distinct from v_profile.licence_file_path,
        'new_ic_photo', v_update.ic_file_path is distinct from v_profile.ic_file_path,
        'gdl_expiry_from', v_profile.gdl_expiry,
        'gdl_expiry_to', coalesce(v_update.gdl_expiry, v_profile.gdl_expiry),
        'new_gdl_photo', v_update.gdl_file_path is distinct from v_profile.gdl_file_path)
    );
  else
    if v_reason is null then
      raise exception 'Give the customer a reason for rejecting.' using errcode = '22023';
    end if;
    if char_length(v_reason) > 500 then
      raise exception 'Keep the reason under 500 characters.' using errcode = '22023';
    end if;

    update public.bubatrent_booking_verification_updates
       set status = 'rejected', reviewed_by = v_uid, reviewed_at = now(), rejection_reason = v_reason
     where id = p_update_id
    returning * into v_update;

    insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
    values (
      v_uid, 'REJECT_VERIFICATION_UPDATE', 'profile', v_update.user_id,
      jsonb_build_object('update_id', v_update.id, 'reason', v_reason)
    );
  end if;

  return v_update;
end;
$function$;

CREATE OR REPLACE FUNCTION public.bubatrent_create_hold_booking(p_car_id uuid, p_pickup date, p_return date)
 RETURNS bubatrent_booking_bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- Commercial vehicles (the panel vans): the driver needs a GDL that is
  -- valid until the return date
  if coalesce(v_car.requires_gdl, false) then
    if v_profile.gdl_expiry is null then
      raise exception 'This is a commercial vehicle: you need a valid GDL (Goods Driving Licence) to rent it. Add your GDL in Verify Account, then book again.'
        using errcode = '42501';
    elsif v_profile.gdl_expiry < p_return then
      raise exception 'Your GDL expires on %, before the return date. Renew it in Verify Account, or choose an earlier return date.',
        to_char(v_profile.gdl_expiry, 'DD/MM/YYYY')
        using errcode = '42501';
    end if;
  end if;

  -- Free dates held by abandoned checkouts and by deposits not verified in
  -- time.
  update public.bubatrent_booking_bookings
     set status = 'EXPIRED', updated_at = now()
   where status = 'HOLD' and hold_expires_at < now();
  perform public.bubatrent_release_unverified_deposits();

  -- Back at checkout for the same car and dates: carry on with that hold
  select * into v_booking
    from public.bubatrent_booking_bookings
   where user_id = v_uid and status = 'HOLD' and car_id = v_car.id
     and pickup_date = p_pickup and return_date = p_return
     and hold_expires_at >= now()
   order by created_at desc
   limit 1
   for update;
  if found then
    return v_booking;
  end if;

  -- Release this customer's other holds (one car at a time)
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
      'HOLD',
      least(now() + interval '24 hours', (p_pickup + 1)::timestamp at time zone 'Asia/Kuala_Lumpur'),
      v_car.fleet_group_id,
      (v_quote->>'long_discount')::numeric
    )
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'Sorry, this car was just booked for those dates. Please choose different dates.'
      using errcode = 'P0001';
  end;

  return v_booking;
end;
$function$;

CREATE OR REPLACE FUNCTION public.bubatrent_merge_walk_in(p_target uuid, p_walk_in uuid, p_matched_by text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_me public.bubatrent_booking_profiles;
  v_match public.bubatrent_booking_profiles;
  v_bookings integer;
  r record;
begin
  select * into v_me from public.bubatrent_booking_profiles where id = p_target;
  select * into v_match from public.bubatrent_booking_profiles where id = p_walk_in for update;

  select count(*) into v_bookings
    from public.bubatrent_booking_bookings where user_id = p_walk_in;

  for r in
    select distinct c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and array_length(c.conkey, 1) = 1
       and c.connamespace = 'public'::regnamespace
       and c.confrelid in ('auth.users'::regclass, 'public.bubatrent_booking_profiles'::regclass)
       and c.conrelid <> 'public.bubatrent_booking_profiles'::regclass
  loop
    execute format('update %s set %I = $1 where %I = $2', r.tbl, r.col, r.col)
      using p_target, p_walk_in;
  end loop;

  update public.bubatrent_booking_profiles
     set display_name = coalesce(nullif(v_me.display_name, ''), v_match.display_name),
         ic_number = coalesce(v_match.ic_number, v_me.ic_number),
         licence_number = coalesce(v_match.licence_number, v_me.licence_number),
         licence_expiry = coalesce(v_match.licence_expiry, v_me.licence_expiry),
         gdl_license = coalesce(v_match.gdl_license, v_me.gdl_license),
         gdl_expiry = case when v_match.gdl_expiry is not null
                           then v_match.gdl_expiry else v_me.gdl_expiry end,
         gdl_file_path = case when v_match.gdl_expiry is not null
                              then v_match.gdl_file_path else v_me.gdl_file_path end,
         ic_file_path = coalesce(v_match.ic_file_path, v_me.ic_file_path),
         licence_file_path = coalesce(v_match.licence_file_path, v_me.licence_file_path),
         address_line1 = coalesce(v_match.address_line1, v_me.address_line1),
         address_line2 = coalesce(v_match.address_line2, v_me.address_line2),
         address_city = coalesce(v_match.address_city, v_me.address_city),
         address_state = coalesce(v_match.address_state, v_me.address_state),
         address_postcode = coalesce(v_match.address_postcode, v_me.address_postcode),
         city = coalesce(v_match.city, v_me.city),
         state = coalesce(v_match.state, v_me.state),
         postcode = coalesce(v_match.postcode, v_me.postcode),
         is_verified = coalesce(v_match.is_verified, false),
         verified_by = v_match.verified_by,
         verified_at = v_match.verified_at,
         created_by_admin = v_match.created_by_admin,
         deposit_credit = coalesce(v_me.deposit_credit, 0) + coalesce(v_match.deposit_credit, 0)
   where id = p_target;

  delete from auth.users where id = p_walk_in;

  insert into public.bubatrent_booking_audit_logs (admin_id, action, resource_type, resource_id, details)
  values (
    null, 'LINK_WALK_IN_ACCOUNT', 'profile', p_target,
    jsonb_build_object(
      'walk_in_id', p_walk_in,
      'walk_in_name', v_match.display_name,
      'walk_in_email', v_match.email,
      'matched_by', p_matched_by,
      'bookings', v_bookings
    )
  );

  return jsonb_build_object(
    'status', 'linked',
    'bookings', v_bookings,
    'credit', coalesce(v_match.deposit_credit, 0),
    'verified', coalesce(v_match.is_verified, false)
  );
end;
$function$;

commit;
