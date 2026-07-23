-- Marketing can create blogs assigned to a Digital Author (author_id may differ from auth.uid()).
-- Run in Supabase SQL editor after 95_blog_author_created_by_access.sql

DROP POLICY IF EXISTS "blogs_insert_policy" ON public.blogs;
CREATE POLICY "blogs_insert_policy" ON public.blogs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_AUTHOR', 'DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
    AND (
      author_id = auth.uid()
      OR created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users_login ul
        JOIN public.roles r ON ul.role_id = r.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
      )
    )
  );

-- Backfill: assign existing marketing-owned blogs to the first Digital Author account.
UPDATE public.blogs b
SET author_id = sub.author_id,
    updated_at = NOW()
FROM (
  SELECT ul.id AS author_id
  FROM public.users_login ul
  JOIN public.roles r ON r.id = ul.role_id
  WHERE r.role_code = 'DIGITAL_AUTHOR'
  ORDER BY ul.full_name NULLS LAST, ul.email
  LIMIT 1
) sub
WHERE sub.author_id IS NOT NULL
  AND (
    b.author_id IS NULL
    OR b.author_id IN (
      SELECT ul2.id
      FROM public.users_login ul2
      JOIN public.roles r2 ON r2.id = ul2.role_id
      WHERE r2.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );
