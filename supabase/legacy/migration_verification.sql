-- ================================================================
-- Rent2Go — User Verification Migration
-- Run this in your Supabase SQL Editor
-- ================================================================

-- Add verification columns to profiles
ALTER TABLE public.bubatrent_booking_profiles
  ADD COLUMN IF NOT EXISTS ic_number TEXT,
  ADD COLUMN IF NOT EXISTS licence_number TEXT,
  ADD COLUMN IF NOT EXISTS licence_expiry DATE,
  ADD COLUMN IF NOT EXISTS ic_file_path TEXT,
  ADD COLUMN IF NOT EXISTS licence_file_path TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);

-- Allow users to update their own profile (for uploading docs)
-- The existing policy only covers UPDATE, we need to ensure it works for the new columns
-- No changes needed — the existing "Users can update own profile" policy covers all columns

-- ================================================================
-- DONE! Run this in Supabase SQL Editor.
-- Users will now need to be verified before they can book.
-- ================================================================
