-- Run this in your Supabase SQL Editor to allow Admins to create customers
-- It uses SECURITY DEFINER to bypass RLS and create a dummy auth user automatically.

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
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Verify caller is an admin
  IF NOT EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized: Admins only';
  END IF;

  -- 2. Insert dummy record into auth.users to satisfy the Foreign Key constraint
  -- (The user won't be able to log in, which is perfect for walk-ins)
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (p_id, p_id::text || '@walkin.local', '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  -- 3. The auth.users trigger (handle_new_user) will have created a basic profile automatically.
  -- We just need to UPDATE that profile with the full customer details.
  UPDATE public.bubatrent_booking_profiles
  SET 
    display_name = COALESCE(p_display_name, display_name),
    ic_number = p_ic_number,
    phone = p_phone,
    address_line1 = p_address_line1,
    address_line2 = p_address_line2,
    city = p_city,
    state = p_state,
    postcode = p_postcode,
    licence_expiry = p_licence_expiry,
    ic_file_path = p_ic_file_path,
    licence_file_path = p_licence_file_path,
    is_verified = true
  WHERE id = p_id;
END;
$$;
