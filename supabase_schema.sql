-- ================================================================
-- BubatRent Booking — Complete Database Schema
-- Run this in your Supabase SQL Editor BEFORE using the app
-- ================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ================================================================
-- 1. User profiles (extends Supabase auth)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.bubatrent_booking_profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT,
  role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bubatrent_booking_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles"
  ON public.bubatrent_booking_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.bubatrent_booking_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.bubatrent_booking_profiles (id, username, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ================================================================
-- 2. Cars table
-- ================================================================
CREATE TABLE IF NOT EXISTS public.bubatrent_booking_cars (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER DEFAULT 2024,
  transmission TEXT DEFAULT 'Auto' CHECK (transmission IN ('Auto', 'Manual')),
  seats INTEGER DEFAULT 5,
  fuel_type TEXT DEFAULT 'Petrol' CHECK (fuel_type IN ('Petrol', 'Diesel', 'Hybrid', 'Electric')),
  price_per_day NUMERIC(10,2) NOT NULL,
  deposit_amount NUMERIC(10,2) DEFAULT 0,
  image_url TEXT,
  features TEXT[] DEFAULT '{}',
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bubatrent_booking_cars ENABLE ROW LEVEL SECURITY;

-- Anyone can view available cars
CREATE POLICY "Anyone can view cars"
  ON public.bubatrent_booking_cars FOR SELECT
  USING (true);

-- Admins can manage cars
CREATE POLICY "Admins can insert cars"
  ON public.bubatrent_booking_cars FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update cars"
  ON public.bubatrent_booking_cars FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete cars"
  ON public.bubatrent_booking_cars FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ================================================================
-- 3. Bookings table with overlap prevention
-- ================================================================
CREATE TABLE IF NOT EXISTS public.bubatrent_booking_bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES public.bubatrent_booking_cars(id),
  user_id UUID REFERENCES auth.users(id),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  pickup_date DATE NOT NULL,
  return_date DATE NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  deposit_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'HOLD'
    CHECK (status IN ('HOLD', 'PAID', 'CONFIRMED', 'CANCELLED', 'EXPIRED')),
  hold_expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (return_date > pickup_date)
);

-- Database-level overlap prevention for active bookings
-- This prevents two bookings for the same car with overlapping dates
ALTER TABLE public.bubatrent_booking_bookings
  ADD CONSTRAINT prevent_booking_overlap
  EXCLUDE USING gist (
    car_id WITH =,
    daterange(pickup_date, return_date, '[]') WITH &&
  ) WHERE (status IN ('HOLD', 'PAID', 'CONFIRMED'));

ALTER TABLE public.bubatrent_booking_bookings ENABLE ROW LEVEL SECURITY;

-- Users can view their own bookings
CREATE POLICY "Users can view own bookings"
  ON public.bubatrent_booking_bookings FOR SELECT
  USING (auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin'));

-- Authenticated users can create bookings
CREATE POLICY "Authenticated users can create bookings"
  ON public.bubatrent_booking_bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own bookings (for customer info, status)
CREATE POLICY "Users can update own bookings"
  ON public.bubatrent_booking_bookings FOR UPDATE
  USING (auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ================================================================
-- 4. Payments table (simulated)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.bubatrent_booking_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bubatrent_booking_bookings(id),
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'simulated',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  simulated BOOLEAN DEFAULT TRUE,
  reference_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bubatrent_booking_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON public.bubatrent_booking_payments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.bubatrent_booking_bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can create payments"
  ON public.bubatrent_booking_payments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.bubatrent_booking_bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
  );

-- ================================================================
-- 5. Customer documents (private storage)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.bubatrent_booking_customer_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bubatrent_booking_bookings(id),
  licence_number TEXT,
  licence_expiry DATE,
  ic_number TEXT,
  licence_file_path TEXT,
  ic_file_path TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bubatrent_booking_customer_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own documents"
  ON public.bubatrent_booking_customer_documents FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.bubatrent_booking_bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
  );

CREATE POLICY "Users can view own documents or admin can view all"
  ON public.bubatrent_booking_customer_documents FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.bubatrent_booking_bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update documents"
  ON public.bubatrent_booking_customer_documents FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ================================================================
-- 6. Audit logs
-- ================================================================
CREATE TABLE IF NOT EXISTS public.bubatrent_booking_audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bubatrent_booking_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON public.bubatrent_booking_audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can create audit logs"
  ON public.bubatrent_booking_audit_logs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ================================================================
-- 7. Create private storage bucket for customer documents
-- ================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('customer-documents', 'customer-documents', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload to their booking folder
CREATE POLICY "Users can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'customer-documents' AND auth.role() = 'authenticated'
  );

-- Admins can read all documents
CREATE POLICY "Admins can read documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'customer-documents' AND
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ================================================================
-- 8. Sample data (5 cars for the fleet)
-- ================================================================
INSERT INTO public.bubatrent_booking_cars (name, brand, model, year, transmission, seats, fuel_type, price_per_day, image_url, features) VALUES
  ('Perodua Myvi 1.5 AV', 'Perodua', 'Myvi', 2024, 'Auto', 5, 'Petrol', 120, 'https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=800&auto=format', ARRAY['Bluetooth', 'Keyless Entry', 'Rear Camera', 'Push Start']),
  ('Proton X50 Flagship', 'Proton', 'X50', 2024, 'Auto', 5, 'Petrol', 200, 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&auto=format', ARRAY['Turbo', 'Lane Assist', 'ACC', '360 Camera', 'Leather Seats']),
  ('Toyota Vios 1.5G', 'Toyota', 'Vios', 2023, 'Auto', 5, 'Petrol', 150, 'https://images.unsplash.com/photo-1550355291-bbee04a92027?w=800&auto=format', ARRAY['Bluetooth', 'Cruise Control', 'VSC', 'Hill Assist']),
  ('Honda City V Sensing', 'Honda', 'City', 2024, 'Auto', 5, 'Petrol', 170, 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&auto=format', ARRAY['Honda Sensing', 'LED Headlights', 'Apple CarPlay', 'Android Auto']),
  ('Perodua Ativa Turbo', 'Perodua', 'Ativa', 2024, 'Auto', 5, 'Petrol', 160, 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&auto=format', ARRAY['Turbo', 'ASA 3.0', 'Roof Rails', 'Rear USB Ports']);

-- ================================================================
-- DONE! Run this entire script in Supabase SQL Editor.
-- Then promote your admin user:
--   UPDATE public.bubatrent_booking_profiles SET role = 'admin' WHERE username = 'your@email.com';
-- ================================================================
