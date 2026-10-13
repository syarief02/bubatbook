-- =====================================================
-- Fix: Allow admins to insert bookings on behalf of customers
-- Run this in Supabase SQL Editor
-- =====================================================

-- Drop the old restrictive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create bookings" ON public.bubatrent_booking_bookings;

-- Create new INSERT policy: users can create own bookings OR admins can create for anyone
CREATE POLICY "Users or admins can create bookings"
  ON public.bubatrent_booking_bookings FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.bubatrent_booking_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
