-- ============================================
-- BLOG MARKETING REQUIREMENTS (Aman Sir)
-- Adds missing tables/columns for:
-- - Mandatory image ALT tags
-- - Multi-category mapping
-- - Stored FAQs (editable + schema)
-- - View counter (per IP + per session)
-- - Pending review status support
-- ============================================

-- 1) Blog images: add alt_text (required, max 125 chars)
ALTER TABLE IF EXISTS public.blog_images
  ADD COLUMN IF NOT EXISTS alt_text VARCHAR(125);

-- Backfill existing rows (best effort)
UPDATE public.blog_images
SET alt_text = LEFT(COALESCE(NULLIF(caption, ''), 'Blog image'), 125)
WHERE alt_text IS NULL;

ALTER TABLE IF EXISTS public.blog_images
  ALTER COLUMN alt_text SET NOT NULL;

ALTER TABLE IF EXISTS public.blog_images
  DROP CONSTRAINT IF EXISTS blog_images_alt_text_len_check;

ALTER TABLE IF EXISTS public.blog_images
  ADD CONSTRAINT blog_images_alt_text_len_check
  CHECK (char_length(alt_text) BETWEEN 1 AND 125);

-- 2) Blogs status: allow 'pending_review' (used by dashboard UI workflows)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blogs_status_check'
  ) THEN
    ALTER TABLE public.blogs DROP CONSTRAINT blogs_status_check;
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- ignore if table not present
END $$;

ALTER TABLE IF EXISTS public.blogs
  ADD CONSTRAINT blogs_status_check
  CHECK (status IN ('draft', 'pending_review', 'published', 'archived'));

-- 3) Multi-category mapping (many-to-many)
CREATE TABLE IF NOT EXISTS public.blog_category_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.blog_categories(id) ON DELETE RESTRICT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (blog_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_blog_category_mapping_blog ON public.blog_category_mapping(blog_id);
CREATE INDEX IF NOT EXISTS idx_blog_category_mapping_category ON public.blog_category_mapping(category_id);

-- 4) FAQs stored separately (editable + schema)
CREATE TABLE IF NOT EXISTS public.blog_faqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT blog_faqs_question_len_check CHECK (char_length(question) BETWEEN 3 AND 500),
  CONSTRAINT blog_faqs_answer_len_check CHECK (char_length(answer) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_blog_faqs_blog ON public.blog_faqs(blog_id);

-- updated_at trigger (reuse update_blog_updated_at if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_blog_updated_at') THEN
    DROP TRIGGER IF EXISTS update_blog_faqs_updated_at ON public.blog_faqs;
    CREATE TRIGGER update_blog_faqs_updated_at
      BEFORE UPDATE ON public.blog_faqs
      FOR EACH ROW
      EXECUTE FUNCTION update_blog_updated_at();
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- ignore
END $$;

-- 5) View counter: per IP + per session (no refresh inflation)
CREATE TABLE IF NOT EXISTS public.blog_view_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  ip_address VARCHAR(100) NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (blog_id, session_id, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_blog_view_sessions_blog ON public.blog_view_sessions(blog_id);
CREATE INDEX IF NOT EXISTS idx_blog_view_sessions_created_at ON public.blog_view_sessions(created_at);

-- Function to record view once per (blog, session, ip) and increment counters
CREATE OR REPLACE FUNCTION public.increment_blog_view(
  p_slug TEXT,
  p_session_id UUID,
  p_ip_address VARCHAR,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_blog_id UUID;
  v_inserted INT := 0;
  v_new_views INT := 0;
BEGIN
  SELECT id INTO v_blog_id FROM public.blogs WHERE slug = p_slug AND status = 'published';
  IF v_blog_id IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.blog_view_sessions (blog_id, session_id, ip_address, user_agent)
  VALUES (v_blog_id, p_session_id, p_ip_address, p_user_agent)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 1 THEN
    UPDATE public.blogs
    SET views = COALESCE(views, 0) + 1
    WHERE id = v_blog_id
    RETURNING views INTO v_new_views;

    INSERT INTO public.blog_read_stats (blog_id, date, views, unique_visitors, avg_read_time)
    VALUES (v_blog_id, CURRENT_DATE, 1, 1, 0)
    ON CONFLICT (blog_id, date)
    DO UPDATE SET
      views = public.blog_read_stats.views + 1,
      unique_visitors = public.blog_read_stats.unique_visitors + 1;
  ELSE
    SELECT COALESCE(views, 0) INTO v_new_views FROM public.blogs WHERE id = v_blog_id;
  END IF;

  RETURN COALESCE(v_new_views, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.increment_blog_view(TEXT, UUID, VARCHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_blog_view(TEXT, UUID, VARCHAR, TEXT) TO anon, authenticated;

COMMENT ON TABLE public.blog_category_mapping IS 'Many-to-many mapping between blogs and categories (multi-category support)';
COMMENT ON TABLE public.blog_faqs IS 'FAQ items for a blog (AI-generated and editable)';
COMMENT ON TABLE public.blog_view_sessions IS 'Tracks unique blog views per IP per session';
COMMENT ON FUNCTION public.increment_blog_view IS 'Increments blog views once per (blog, session, ip) and updates daily stats';


