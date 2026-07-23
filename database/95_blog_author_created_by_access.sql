-- Allow Digital Authors to access blogs they created even if author_id differs (legacy/import rows).
-- Run once on Supabase SQL editor.

DROP POLICY IF EXISTS "blogs_select_policy" ON public.blogs;
CREATE POLICY "blogs_select_policy" ON public.blogs
  FOR SELECT
  TO authenticated, anon
  USING (
    status = 'published'
    OR (auth.uid() IS NOT NULL AND (author_id = auth.uid() OR created_by = auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );

DROP POLICY IF EXISTS "blogs_update_policy" ON public.blogs;
CREATE POLICY "blogs_update_policy" ON public.blogs
  FOR UPDATE
  USING (
    author_id = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );
