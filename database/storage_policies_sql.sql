-- ============================================
-- STORAGE RLS POLICIES - SQL COMMANDS
-- Run these in Supabase SQL Editor
-- ============================================

-- Policy 1: Allow authenticated users to upload (INSERT)
CREATE POLICY "Authenticated users can upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'service-media'
);

-- Policy 2: Allow public read access (SELECT)
CREATE POLICY "Public read access"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'service-media'
);

-- Policy 3: Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'service-media'
);

-- Policy 4: Allow authenticated users to update
CREATE POLICY "Authenticated users can update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'service-media'
)
WITH CHECK (
  bucket_id = 'service-media'
);

-- Verify policies were created
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
AND policyname LIKE '%service-media%' OR policyname LIKE '%Authenticated%' OR policyname LIKE '%Public%'
ORDER BY policyname;

