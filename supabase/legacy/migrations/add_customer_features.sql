-- =====================================================
-- Features A-G Migration: Manual Customers + GDL License
-- =====================================================

-- A) Add admin-created customer tracking
ALTER TABLE bubatrent_booking_profiles
  ADD COLUMN IF NOT EXISTS created_by_admin UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- B) Add GDL license option
ALTER TABLE bubatrent_booking_profiles
  ADD COLUMN IF NOT EXISTS gdl_license TEXT DEFAULT 'NONE';

-- Allow profiles table to accept inserts from admins (for manual customers)
-- The id column references auth.users, but manual customers won't have auth accounts
-- We need to drop the FK constraint for this to work
-- Instead, we'll use a separate approach: admin inserts use service role

-- D) Allow EXPIRED booking reactivation tracking
ALTER TABLE bubatrent_booking_bookings
  ADD COLUMN IF NOT EXISTS reactivated_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reactivation_reason TEXT;

-- E) Track admin-created bookings
ALTER TABLE bubatrent_booking_bookings
  ADD COLUMN IF NOT EXISTS created_by_admin UUID REFERENCES auth.users(id);
