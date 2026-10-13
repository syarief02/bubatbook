-- ================================================================
-- Rent2Go — System Overhaul Migration
-- Run this in Supabase SQL Editor
-- ================================================================

-- ================================================================
-- 1. Update profiles table — add address + credit
-- ================================================================
ALTER TABLE public.bubatrent_booking_profiles
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postcode TEXT,
  ADD COLUMN IF NOT EXISTS deposit_credit NUMERIC(10,2) DEFAULT 0;

-- Drop licence_number if it exists (IC number IS the licence in Malaysia)
ALTER TABLE public.bubatrent_booking_profiles DROP COLUMN IF EXISTS licence_number;

-- ================================================================
-- 2. Update bookings table — new statuses + payment tracking
-- ================================================================

-- First update the status constraint
ALTER TABLE public.bubatrent_booking_bookings DROP CONSTRAINT IF EXISTS bubatrent_booking_bookings_status_check;
ALTER TABLE public.bubatrent_booking_bookings
  ADD CONSTRAINT bubatrent_booking_bookings_status_check
  CHECK (status IN ('HOLD','DEPOSIT_PAID','CONFIRMED','PICKUP','RETURNED','CANCELLED','EXPIRED'));

-- Migrate existing PAID bookings to DEPOSIT_PAID
UPDATE public.bubatrent_booking_bookings SET status = 'DEPOSIT_PAID' WHERE status = 'PAID';

-- Add new columns for two-part payment
ALTER TABLE public.bubatrent_booking_bookings
  ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'pending_upload'
    CHECK (deposit_status IN ('pending_upload','uploaded','verified','rejected')),
  ADD COLUMN IF NOT EXISTS full_payment_status TEXT DEFAULT 'pending'
    CHECK (full_payment_status IN ('pending','pending_upload','uploaded','verified','rejected')),
  ADD COLUMN IF NOT EXISTS deposit_receipt_path TEXT,
  ADD COLUMN IF NOT EXISTS full_payment_receipt_path TEXT,
  ADD COLUMN IF NOT EXISTS full_payment_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS actual_return_date DATE,
  ADD COLUMN IF NOT EXISTS credit_applied NUMERIC(10,2) DEFAULT 0;

-- Update the overlap exclusion constraint to include new active statuses
ALTER TABLE public.bubatrent_booking_bookings DROP CONSTRAINT IF EXISTS prevent_booking_overlap;
ALTER TABLE public.bubatrent_booking_bookings
  ADD CONSTRAINT prevent_booking_overlap
  EXCLUDE USING gist (
    car_id WITH =,
    daterange(pickup_date, return_date, '[]') WITH &&
  ) WHERE (status IN ('HOLD', 'DEPOSIT_PAID', 'CONFIRMED', 'PICKUP'));

-- ================================================================
-- 3. Verification updates table (pending doc re-submissions)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.bubatrent_booking_verification_updates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ic_number TEXT,
  licence_expiry DATE,
  ic_file_path TEXT,
  licence_file_path TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bubatrent_booking_verification_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own verification updates"
  ON public.bubatrent_booking_verification_updates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own or admin can view all verification updates"
  ON public.bubatrent_booking_verification_updates FOR SELECT
  USING (auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update verification updates"
  ON public.bubatrent_booking_verification_updates FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ================================================================
-- 4. Credit transactions table (audit trail)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.bubatrent_booking_credit_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  booking_id UUID REFERENCES public.bubatrent_booking_bookings(id),
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit_return', 'applied', 'deducted', 'payout')),
  description TEXT,
  admin_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bubatrent_booking_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit transactions"
  ON public.bubatrent_booking_credit_transactions FOR SELECT
  USING (auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "System can insert credit transactions"
  ON public.bubatrent_booking_credit_transactions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ================================================================
-- 5. Expense claims table
-- ================================================================
CREATE TABLE IF NOT EXISTS public.bubatrent_booking_expense_claims (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  car_id UUID REFERENCES public.bubatrent_booking_cars(id),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  expense_date DATE NOT NULL,
  description TEXT NOT NULL,
  total_amount NUMERIC(10,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  payment_receipt_path TEXT,
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bubatrent_booking_expense_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage expense claims"
  ON public.bubatrent_booking_expense_claims FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ================================================================
-- 6. Expense images table (multiple per claim)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.bubatrent_booking_expense_images (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  claim_id UUID NOT NULL REFERENCES public.bubatrent_booking_expense_claims(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bubatrent_booking_expense_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage expense images"
  ON public.bubatrent_booking_expense_images FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ================================================================
-- 7. Update payments table to support two-part payments
-- ================================================================
ALTER TABLE public.bubatrent_booking_payments
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'deposit'
    CHECK (payment_type IN ('deposit', 'full_payment')),
  ADD COLUMN IF NOT EXISTS receipt_path TEXT;

-- Admin can update payments
CREATE POLICY "Admins can update payments"
  ON public.bubatrent_booking_payments FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.bubatrent_booking_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ================================================================
-- DONE! Migration complete.
-- ================================================================
