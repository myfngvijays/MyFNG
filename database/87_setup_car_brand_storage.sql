-- Setup storage bucket for car brand logos
-- This migration creates the 'car-brand' bucket and sets up RLS policies

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'car-brand',
  'car-brand',
  true, -- Public bucket so logos can be accessed without auth
  5242880, -- 5MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/svg+xml'];

-- Drop existing policies if they exist (to allow re-running)
DROP POLICY IF EXISTS "Super admin can upload car brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Super admin can update car brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Super admin can delete car brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view car brand logos" ON storage.objects;

-- RLS Policy: Allow super admin to upload logos
CREATE POLICY "Super admin can upload car brand logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'car-brand'
  AND (
    -- Check if user is super admin via users_login and roles tables
    EXISTS (
      SELECT 1 
      FROM public.users_login ul
      JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
      AND r.role_code = 'SUPER_ADMIN'
    )
    -- Fallback: if tables don't exist, allow authenticated users (temporary)
    OR NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users_login'
    )
  )
);

-- RLS Policy: Allow super admin to update logos
CREATE POLICY "Super admin can update car brand logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'car-brand'
  AND (
    EXISTS (
      SELECT 1 
      FROM public.users_login ul
      JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
      AND r.role_code = 'SUPER_ADMIN'
    )
    OR NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users_login'
    )
  )
)
WITH CHECK (
  bucket_id = 'car-brand'
  AND (
    EXISTS (
      SELECT 1 
      FROM public.users_login ul
      JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
      AND r.role_code = 'SUPER_ADMIN'
    )
    OR NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users_login'
    )
  )
);

-- RLS Policy: Allow super admin to delete logos
CREATE POLICY "Super admin can delete car brand logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'car-brand'
  AND (
    EXISTS (
      SELECT 1 
      FROM public.users_login ul
      JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
      AND r.role_code = 'SUPER_ADMIN'
    )
    OR NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users_login'
    )
  )
);

-- RLS Policy: Allow anyone to view logos (public bucket)
CREATE POLICY "Anyone can view car brand logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'car-brand');

