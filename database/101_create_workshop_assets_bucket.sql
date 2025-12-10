-- ================================================================
-- WORKSHOP ASSETS STORAGE BUCKET - RLS POLICIES ONLY
-- ================================================================
-- ⚠️ IMPORTANT: DO NOT TRY TO CREATE BUCKET VIA SQL
-- Storage buckets CANNOT be created via SQL queries.
-- You MUST create the bucket through Supabase Dashboard first!
-- 
-- STEPS TO SETUP:
-- ================================================================
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "New bucket" button
-- 3. Name: workshop-assets (exact name)
-- 4. Public bucket: ✅ CHECK THIS BOX
-- 5. Click "Create bucket"
-- 6. AFTER bucket is created, come back and run this SQL
-- ================================================================
-- This SQL file ONLY creates RLS policies for the existing bucket.
-- It does NOT create the bucket itself.
-- ================================================================

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Public can view workshop assets" ON storage.objects;
DROP POLICY IF EXISTS "Super Admin can upload workshop assets" ON storage.objects;
DROP POLICY IF EXISTS "Super Admin can update workshop assets" ON storage.objects;
DROP POLICY IF EXISTS "Super Admin can delete workshop assets" ON storage.objects;
DROP POLICY IF EXISTS "Workshop owner can upload own workshop assets" ON storage.objects;
DROP POLICY IF EXISTS "Workshop owner can update own workshop assets" ON storage.objects;
DROP POLICY IF EXISTS "Workshop owner can delete own workshop assets" ON storage.objects;

-- Set up RLS policies for the bucket
-- Allow public read access (for public workshop pages)
CREATE POLICY "Public can view workshop assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'workshop-assets');

-- Allow authenticated users (Super Admin) to upload
CREATE POLICY "Super Admin can upload workshop assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'workshop-assets' AND
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Allow Super Admin to update/delete
CREATE POLICY "Super Admin can update workshop assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'workshop-assets' AND
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

CREATE POLICY "Super Admin can delete workshop assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'workshop-assets' AND
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Workshop Owner can upload images for their own workshop
-- Path structure: workshop-public-pages/{workshop_id}/{filename}
CREATE POLICY "Workshop owner can upload own workshop assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'workshop-assets' AND
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() 
      AND ul.workshop_id IS NOT NULL
      AND r.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
      AND (storage.foldername(name))[1] = 'workshop-public-pages'
      AND (storage.foldername(name))[2]::text = ul.workshop_id::text
  )
);

-- Workshop Owner can update images for their own workshop
CREATE POLICY "Workshop owner can update own workshop assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'workshop-assets' AND
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() 
      AND ul.workshop_id IS NOT NULL
      AND r.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
      AND (storage.foldername(name))[1] = 'workshop-public-pages'
      AND (storage.foldername(name))[2]::text = ul.workshop_id::text
  )
);

-- Workshop Owner can delete images for their own workshop
CREATE POLICY "Workshop owner can delete own workshop assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'workshop-assets' AND
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() 
      AND ul.workshop_id IS NOT NULL
      AND r.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
      AND (storage.foldername(name))[1] = 'workshop-public-pages'
      AND (storage.foldername(name))[2]::text = ul.workshop_id::text
  )
);

-- Note: Comment statements removed as they require owner privileges
-- The policies above will work correctly without comments
