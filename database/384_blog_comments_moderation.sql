-- Blog comments stay hidden until a blog admin approves them.
-- status: 0 = pending, 1 = approved

ALTER TABLE public.blog_comments
  ALTER COLUMN status SET DEFAULT 0;

DROP POLICY IF EXISTS "blog_comments_insert_policy" ON public.blog_comments;

-- Public inserts stay pending. Blog admins may insert an approved reply.
CREATE POLICY "blog_comments_insert_policy" ON public.blog_comments
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_comments.blog_id
      AND b.status = 'published'
    )
    AND (
      COALESCE(status, 0) = 0
      OR EXISTS (
        SELECT 1 FROM public.users_login ul
        JOIN public.roles r ON ul.role_id = r.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
      )
    )
  );
