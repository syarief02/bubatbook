CREATE OR REPLACE FUNCTION admin_create_walkin_customer(
  p_id UUID, p_display_name TEXT, p_ic_number TEXT, p_phone TEXT, 
  p_address_line1 TEXT, p_address_line2 TEXT, p_city TEXT, p_state TEXT, 
  p_postcode TEXT, p_licence_expiry DATE, p_ic_file_path TEXT, 
  p_licence_file_path TEXT, p_admin_id UUID
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO auth.users (id, email) VALUES (p_id, p_id::text || '@walkin.local') ON CONFLICT DO NOTHING;
  
  INSERT INTO public.bubatrent_booking_profiles (
    id, display_name, ic_number, phone, address_line1, address_line2, 
    city, state, postcode, licence_expiry, ic_file_path, licence_file_path, 
    is_verified
  ) VALUES (
    p_id, p_display_name, p_ic_number, p_phone, p_address_line1, p_address_line2, 
    p_city, p_state, p_postcode, p_licence_expiry, p_ic_file_path, p_licence_file_path, 
    true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;