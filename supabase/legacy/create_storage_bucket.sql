-- Create the customer-documents storage bucket
-- Run this in your Supabase SQL Editor (Dashboard → SQL → New query)

-- Create the bucket (public = true so getPublicUrl works)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-documents',
  'customer-documents',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- RLS policies for the bucket

-- Allow authenticated users to upload their own files
CREATE POLICY IF NOT EXISTS "Users can upload own docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'customer-documents'
  AND (storage.foldername(name))[1] = 'profiles'
);

-- Allow authenticated users to read their own files
CREATE POLICY IF NOT EXISTS "Users can read own docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'customer-documents'
);

-- Allow admins to read all docs (public bucket handles this)
-- Allow admins to upload for any user
CREATE POLICY IF NOT EXISTS "Admins can upload any docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'customer-documents'
  AND EXISTS (
    SELECT 1 FROM bubatrent_booking_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Public read access (since bucket is public)
CREATE POLICY IF NOT EXISTS "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'customer-documents');
