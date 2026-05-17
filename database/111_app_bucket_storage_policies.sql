-- =====================================================
-- Storage policies: allow Super Admin to manage files in
-- the public `App` bucket (used for hero + promo banners
-- uploaded via the Super Admin dashboard).
-- Public read is already implicit because the bucket is
-- marked public; we only need write permissions for
-- authenticated super admins.
-- =====================================================

-- Drop old versions of the same policies if they exist
DROP POLICY IF EXISTS "Super admin can insert into App bucket" ON storage.objects;
DROP POLICY IF EXISTS "Super admin can update App bucket"     ON storage.objects;
DROP POLICY IF EXISTS "Super admin can delete from App bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public can read App bucket"             ON storage.objects;

-- Anyone (anon + authenticated) can read files in the public App bucket.
CREATE POLICY "Public can read App bucket" ON storage.objects
FOR SELECT
USING (bucket_id = 'App');

-- Super admins can upload (INSERT) new files.
CREATE POLICY "Super admin can insert into App bucket" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'App' AND EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Super admins can update existing files (e.g. when replacing an image).
CREATE POLICY "Super admin can update App bucket" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'App' AND EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
)
WITH CHECK (
  bucket_id = 'App' AND EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Super admins can delete files.
CREATE POLICY "Super admin can delete from App bucket" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'App' AND EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);
