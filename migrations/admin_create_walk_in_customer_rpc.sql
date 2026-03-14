CREATE OR REPLACE FUNCTION admin_create_walk_in_customer(
  p_id UUID,
  p_display_name TEXT,
  p_ic_number TEXT,
  p_phone TEXT,
  p_address_line1 TEXT,
  p_address_line2 TEXT,
  p_city TEXT,
  p_state TEXT,
  p_postcode TEXT,
  p_licence_expiry DATE,
  p_ic_file_path TEXT,
  p_licence_file_path TEXT,
  p_admin_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert dummy user into auth.users to satisfy foreign key constraints
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    p_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'walkin_' || p_id || '@bubatrent.local',
    crypt('dummy_password', gen_salt('bf')),
    now(),
    jsonb_build_object('name', p_display_name, 'is_walk_in', true),
    now(),
    now()
  );

  -- Insert profile
  INSERT INTO public.bubatrent_booking_profiles (
    id,
    display_name,
    ic_number,
    phone,
    address_line1,
    address_line2,
    city,
    state,
    postcode,
    licence_expiry,
    ic_file_path,
    licence_file_path,
    created_by_admin,
    verified_by,
    verified_at,
    role
  ) VALUES (
    p_id,
    p_display_name,
    p_ic_number,
    p_phone,
    p_address_line1,
    p_address_line2,
    p_city,
    p_state,
    p_postcode,
    p_licence_expiry,
    p_ic_file_path,
    p_licence_file_path,
    p_admin_id,
    p_admin_id,
    now(),
    'customer'
  );
END;
$$;
