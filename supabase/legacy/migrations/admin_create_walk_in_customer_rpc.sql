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
  p_admin_id UUID,
  p_email TEXT DEFAULT NULL,
  p_gdl_license TEXT DEFAULT 'NONE'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- Determine email: use provided email or generate walk-in fallback
  IF p_email IS NOT NULL AND trim(p_email) <> '' THEN
    v_email := trim(p_email);
  ELSE
    v_email := 'walkin_' || p_id || '@bubatrent.local';
  END IF;

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
    v_email,
    extensions.crypt('dummy_password', extensions.gen_salt('bf')),
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
    email,
    address_line1,
    address_line2,
    city,
    state,
    postcode,
    licence_expiry,
    gdl_license,
    ic_file_path,
    licence_file_path,
    created_by_admin,
    verified_by,
    verified_at,
    is_verified,
    role
  ) VALUES (
    p_id,
    p_display_name,
    p_ic_number,
    p_phone,
    v_email,
    p_address_line1,
    p_address_line2,
    p_city,
    p_state,
    p_postcode,
    p_licence_expiry,
    COALESCE(p_gdl_license, 'NONE'),
    p_ic_file_path,
    p_licence_file_path,
    p_admin_id,
    p_admin_id,
    now(),
    true,
    'customer'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    ic_number = EXCLUDED.ic_number,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    address_line1 = EXCLUDED.address_line1,
    address_line2 = EXCLUDED.address_line2,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    postcode = EXCLUDED.postcode,
    licence_expiry = EXCLUDED.licence_expiry,
    gdl_license = EXCLUDED.gdl_license,
    ic_file_path = EXCLUDED.ic_file_path,
    licence_file_path = EXCLUDED.licence_file_path,
    created_by_admin = EXCLUDED.created_by_admin,
    verified_by = EXCLUDED.verified_by,
    verified_at = EXCLUDED.verified_at,
    is_verified = true,
    role = 'customer';
END;
$$;
