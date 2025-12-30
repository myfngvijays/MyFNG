-- ============================================
-- BLOG MARKETING REQUIREMENTS - RLS POLICIES
-- New tables:
-- - blog_category_mapping
-- - blog_faqs
-- - blog_view_sessions
-- Also ensures blog_images alt_text constraints are respected by API layer.
-- ============================================

-- Enable RLS
ALTER TABLE IF EXISTS public.blog_category_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blog_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blog_view_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (re-runnable)
DROP POLICY IF EXISTS "blog_category_mapping_select_policy" ON public.blog_category_mapping;
DROP POLICY IF EXISTS "blog_category_mapping_insert_policy" ON public.blog_category_mapping;
DROP POLICY IF EXISTS "blog_category_mapping_delete_policy" ON public.blog_category_mapping;

DROP POLICY IF EXISTS "blog_faqs_select_policy" ON public.blog_faqs;
DROP POLICY IF EXISTS "blog_faqs_insert_policy" ON public.blog_faqs;
DROP POLICY IF EXISTS "blog_faqs_update_policy" ON public.blog_faqs;
DROP POLICY IF EXISTS "blog_faqs_delete_policy" ON public.blog_faqs;

DROP POLICY IF EXISTS "blog_view_sessions_insert_policy" ON public.blog_view_sessions;
DROP POLICY IF EXISTS "blog_view_sessions_select_policy" ON public.blog_view_sessions;

-- Helper: role check
-- Digital Marketing and Super Admin are privileged.

-- BLOG_CATEGORY_MAPPING
CREATE POLICY "blog_category_mapping_select_policy" ON public.blog_category_mapping
  FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_category_mapping.blog_id
      AND (
        b.status = 'published'
        OR (auth.uid() IS NOT NULL AND b.author_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.users_login ul
          JOIN public.roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
        )
      )
    )
  );

CREATE POLICY "blog_category_mapping_insert_policy" ON public.blog_category_mapping
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_category_mapping.blog_id
      AND (
        b.author_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.users_login ul
          JOIN public.roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
        )
      )
    )
  );

CREATE POLICY "blog_category_mapping_delete_policy" ON public.blog_category_mapping
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_category_mapping.blog_id
      AND (
        b.author_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.users_login ul
          JOIN public.roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
        )
      )
    )
  );

-- BLOG_FAQS
CREATE POLICY "blog_faqs_select_policy" ON public.blog_faqs
  FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_faqs.blog_id
      AND (
        b.status = 'published'
        OR (auth.uid() IS NOT NULL AND b.author_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.users_login ul
          JOIN public.roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
        )
      )
    )
  );

CREATE POLICY "blog_faqs_insert_policy" ON public.blog_faqs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_faqs.blog_id
      AND (
        b.author_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.users_login ul
          JOIN public.roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
        )
      )
    )
  );

CREATE POLICY "blog_faqs_update_policy" ON public.blog_faqs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_faqs.blog_id
      AND (
        b.author_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.users_login ul
          JOIN public.roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
        )
      )
    )
  );

CREATE POLICY "blog_faqs_delete_policy" ON public.blog_faqs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_faqs.blog_id
      AND (
        b.author_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.users_login ul
          JOIN public.roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
        )
      )
    )
  );

-- BLOG_VIEW_SESSIONS (analytics) - only allow inserts; restrict selects to privileged roles
CREATE POLICY "blog_view_sessions_insert_policy" ON public.blog_view_sessions
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "blog_view_sessions_select_policy" ON public.blog_view_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );


