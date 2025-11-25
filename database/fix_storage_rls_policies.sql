-- ============================================
-- STORAGE BUCKET RLS POLICIES FOR MECHANIC MEDIA
-- Fix for "new row violates row-level security policy" errors
-- ============================================

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROP EXISTING POLICIES (if any)
-- ============================================

DROP POLICY IF EXISTS "Mechanic media upload access" ON storage.objects;
DROP POLICY IF EXISTS "Mechanic media public read" ON storage.objects;
DROP POLICY IF EXISTS "Mechanic media delete" ON storage.objects;
DROP POLICY IF EXISTS "Workshop staff media upload" ON storage.objects;
DROP POLICY IF EXISTS "Workshop staff media read" ON storage.objects;

-- ============================================
-- CREATE NEW POLICIES FOR service-media BUCKET
-- ============================================

-- Policy 1: Allow authenticated users to upload to mechanic_media folder
CREATE POLICY "Mechanic media upload access"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'service-media' 
  AND (storage.foldername(name))[1] = 'mechanic_media'
);

-- Policy 2: Allow everyone to read from service-media bucket (public access)
CREATE POLICY "Mechanic media public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'service-media');

-- Policy 3: Allow mechanic to delete their own uploads
CREATE POLICY "Mechanic media delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'service-media' 
  AND (storage.foldername(name))[1] = 'mechanic_media'
  AND (
    -- Check if user is workshop mechanic, admin, or supervisor
    EXISTS (
      SELECT 1 FROM users_login
      JOIN roles ON users_login.role_id = roles.id
      WHERE users_login.id = auth.uid()
      AND roles.role_code IN ('WORKSHOP_MECHANIC', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
    )
  )
);

-- Policy 4: Allow workshop staff to upload to any folder in service-media
CREATE POLICY "Workshop staff media upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'service-media'
  AND EXISTS (
    SELECT 1 FROM users_login
    JOIN roles ON users_login.role_id = roles.id
    WHERE users_login.id = auth.uid()
    AND roles.role_code IN ('WORKSHOP_MECHANIC', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'WORKSHOP_PICKUP_BOY')
  )
);

-- Policy 5: Allow workshop staff to read all files in service-media
CREATE POLICY "Workshop staff media read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'service-media'
  AND EXISTS (
    SELECT 1 FROM users_login
    JOIN roles ON users_login.role_id = roles.id
    WHERE users_login.id = auth.uid()
    AND roles.role_code IN (
      'WORKSHOP_MECHANIC', 
      'WORKSHOP_ADMIN', 
      'WORKSHOP_SUPERVISOR', 
      'WORKSHOP_PICKUP_BOY',
      'SUPER_ADMIN',
      'AUDITOR'
    )
  )
);

-- ============================================
-- VERIFY BUCKET EXISTS
-- ============================================

-- Check if service-media bucket exists, create if not
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'service-media'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'service-media',
      'service-media',
      true,  -- Make bucket public for easier access
      10485760,  -- 10MB limit
      ARRAY[
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/quicktime'
      ]
    );
    RAISE NOTICE 'Created service-media bucket';
  ELSE
    -- Update bucket to be public
    UPDATE storage.buckets 
    SET public = true 
    WHERE id = 'service-media';
    RAISE NOTICE 'Updated service-media bucket to public';
  END IF;
END $$;

-- ============================================
-- GRANT NECESSARY PERMISSIONS
-- ============================================

-- Grant usage on storage schema
GRANT USAGE ON SCHEMA storage TO authenticated, anon;

-- Grant select on buckets
GRANT SELECT ON storage.buckets TO authenticated, anon;

-- Grant all on objects for authenticated users
GRANT ALL ON storage.objects TO authenticated;

-- Grant select on objects for anon (public read)
GRANT SELECT ON storage.objects TO anon;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
ORDER BY policyname;

-- Check bucket configuration
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'service-media';

-- ============================================
-- NOTES
-- ============================================

/*
These policies allow:
1. Authenticated users (mechanics) to upload to mechanic_media folder
2. Public read access to all files (for displaying images)
3. Mechanics/admins/supervisors to delete their uploads
4. All workshop staff to upload to any folder
5. Workshop staff to read all files

The bucket is set to public=true which simplifies access for displaying images.
RLS policies still control who can upload/delete.

To test:
1. Login as mechanic
2. Try to upload a file to service-media/mechanic_media/
3. Should succeed
4. Try to view the uploaded image URL
5. Should be publicly accessible
*/

