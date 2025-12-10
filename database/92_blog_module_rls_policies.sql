-- ============================================
-- BLOG MODULE - RLS Policies
-- Enable Row Level Security and create policies for all blog tables
-- ============================================

-- Enable RLS on all blog tables
ALTER TABLE IF EXISTS public.blogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blog_tag_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blog_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blog_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blog_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blog_read_stats ENABLE ROW LEVEL SECURITY;

-- ============================================
-- BLOGS TABLE POLICIES
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "blogs_select_policy" ON public.blogs;
DROP POLICY IF EXISTS "blogs_insert_policy" ON public.blogs;
DROP POLICY IF EXISTS "blogs_update_policy" ON public.blogs;
DROP POLICY IF EXISTS "blogs_delete_policy" ON public.blogs;

-- SELECT: Everyone can view published blogs, authenticated authors can view their own, Digital Marketing can view all
CREATE POLICY "blogs_select_policy" ON public.blogs
  FOR SELECT
  TO authenticated, anon
  USING (
    status = 'published' 
    OR (auth.uid() IS NOT NULL AND author_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );

-- INSERT: Digital Author and Digital Marketing can create blogs
CREATE POLICY "blogs_insert_policy" ON public.blogs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_AUTHOR', 'DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
    AND author_id = auth.uid()
  );

-- UPDATE: Authors can update their own blogs, Digital Marketing can update any
CREATE POLICY "blogs_update_policy" ON public.blogs
  FOR UPDATE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );

-- DELETE: Only Digital Marketing and Super Admin can delete
CREATE POLICY "blogs_delete_policy" ON public.blogs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );

-- ============================================
-- BLOG_CATEGORIES TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "blog_categories_select_policy" ON public.blog_categories;
DROP POLICY IF EXISTS "blog_categories_insert_policy" ON public.blog_categories;
DROP POLICY IF EXISTS "blog_categories_update_policy" ON public.blog_categories;
DROP POLICY IF EXISTS "blog_categories_delete_policy" ON public.blog_categories;

-- SELECT: Everyone can view active categories
CREATE POLICY "blog_categories_select_policy" ON public.blog_categories
  FOR SELECT
  TO authenticated, anon
  USING (status = 1 OR status IS NULL);

-- INSERT/UPDATE/DELETE: Only Digital Marketing and Super Admin
CREATE POLICY "blog_categories_insert_policy" ON public.blog_categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "blog_categories_update_policy" ON public.blog_categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "blog_categories_delete_policy" ON public.blog_categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );

-- ============================================
-- BLOG_TAGS TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "blog_tags_select_policy" ON public.blog_tags;
DROP POLICY IF EXISTS "blog_tags_insert_policy" ON public.blog_tags;
DROP POLICY IF EXISTS "blog_tags_update_policy" ON public.blog_tags;
DROP POLICY IF EXISTS "blog_tags_delete_policy" ON public.blog_tags;

-- SELECT: Everyone can view tags
CREATE POLICY "blog_tags_select_policy" ON public.blog_tags
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- INSERT/UPDATE/DELETE: Only Digital Marketing and Super Admin
CREATE POLICY "blog_tags_insert_policy" ON public.blog_tags
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "blog_tags_update_policy" ON public.blog_tags
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "blog_tags_delete_policy" ON public.blog_tags
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );

-- ============================================
-- BLOG_TAG_MAPPING TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "blog_tag_mapping_select_policy" ON public.blog_tag_mapping;
DROP POLICY IF EXISTS "blog_tag_mapping_insert_policy" ON public.blog_tag_mapping;
DROP POLICY IF EXISTS "blog_tag_mapping_delete_policy" ON public.blog_tag_mapping;

-- SELECT: Users can view mappings for blogs they can view
CREATE POLICY "blog_tag_mapping_select_policy" ON public.blog_tag_mapping
  FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_tag_mapping.blog_id
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

-- INSERT/DELETE: Blog authors and Digital Marketing can manage mappings
CREATE POLICY "blog_tag_mapping_insert_policy" ON public.blog_tag_mapping
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_tag_mapping.blog_id
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

CREATE POLICY "blog_tag_mapping_delete_policy" ON public.blog_tag_mapping
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_tag_mapping.blog_id
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

-- ============================================
-- BLOG_VERSIONS TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "blog_versions_select_policy" ON public.blog_versions;
DROP POLICY IF EXISTS "blog_versions_insert_policy" ON public.blog_versions;

-- SELECT: Only Digital Marketing and Super Admin can view versions
CREATE POLICY "blog_versions_select_policy" ON public.blog_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );

-- INSERT: System only (via trigger)
CREATE POLICY "blog_versions_insert_policy" ON public.blog_versions
  FOR INSERT
  WITH CHECK (true); -- Trigger handles version creation

-- ============================================
-- BLOG_COMMENTS TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "blog_comments_select_policy" ON public.blog_comments;
DROP POLICY IF EXISTS "blog_comments_insert_policy" ON public.blog_comments;
DROP POLICY IF EXISTS "blog_comments_update_policy" ON public.blog_comments;
DROP POLICY IF EXISTS "blog_comments_delete_policy" ON public.blog_comments;

-- SELECT: Everyone can view approved comments on published blogs
CREATE POLICY "blog_comments_select_policy" ON public.blog_comments
  FOR SELECT
  TO authenticated, anon
  USING (
    (
      status = 1
      AND EXISTS (
        SELECT 1 FROM public.blogs b
        WHERE b.id = blog_comments.blog_id
        AND b.status = 'published'
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );

-- INSERT: Anyone (authenticated or anonymous) can comment on published blogs
CREATE POLICY "blog_comments_insert_policy" ON public.blog_comments
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_comments.blog_id
      AND b.status = 'published'
    )
  );

-- UPDATE/DELETE: Only Digital Marketing and Super Admin can moderate
CREATE POLICY "blog_comments_update_policy" ON public.blog_comments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "blog_comments_delete_policy" ON public.blog_comments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('DIGITAL_MARKETING', 'SUPER_ADMIN')
    )
  );

-- ============================================
-- BLOG_IMAGES TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "blog_images_select_policy" ON public.blog_images;
DROP POLICY IF EXISTS "blog_images_insert_policy" ON public.blog_images;
DROP POLICY IF EXISTS "blog_images_delete_policy" ON public.blog_images;

-- SELECT: Users can view images for blogs they can view
CREATE POLICY "blog_images_select_policy" ON public.blog_images
  FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_images.blog_id
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

-- INSERT/DELETE: Blog authors and Digital Marketing
CREATE POLICY "blog_images_insert_policy" ON public.blog_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_images.blog_id
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

CREATE POLICY "blog_images_delete_policy" ON public.blog_images
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_images.blog_id
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

-- ============================================
-- BLOG_READ_STATS TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "blog_read_stats_select_policy" ON public.blog_read_stats;
DROP POLICY IF EXISTS "blog_read_stats_insert_policy" ON public.blog_read_stats;
DROP POLICY IF EXISTS "blog_read_stats_update_policy" ON public.blog_read_stats;

-- SELECT: Blog authors and Digital Marketing can view stats
CREATE POLICY "blog_read_stats_select_policy" ON public.blog_read_stats
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_read_stats.blog_id
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

-- INSERT/UPDATE: System only (for analytics tracking)
CREATE POLICY "blog_read_stats_insert_policy" ON public.blog_read_stats
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "blog_read_stats_update_policy" ON public.blog_read_stats
  FOR UPDATE
  USING (true);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON POLICY "blogs_select_policy" ON public.blogs IS 'Allow viewing published blogs or own blogs or if Digital Marketing/Super Admin';
COMMENT ON POLICY "blogs_insert_policy" ON public.blogs IS 'Allow Digital Author and Digital Marketing to create blogs';
COMMENT ON POLICY "blogs_update_policy" ON public.blogs IS 'Allow authors to update own blogs, Digital Marketing can update any';
COMMENT ON POLICY "blogs_delete_policy" ON public.blogs IS 'Only Digital Marketing and Super Admin can delete blogs';
