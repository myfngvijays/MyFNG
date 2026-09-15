-- 365_daily_blog_auto_post.sql
-- Daily auto-publish: one AI blog at 10:00 AM IST via /api/cron/daily-blog

CREATE TABLE IF NOT EXISTS public.daily_blog_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  city TEXT NOT NULL DEFAULT 'Pune',
  tone TEXT NOT NULL DEFAULT 'Professional',
  word_count INT NOT NULL DEFAULT 900,
  category_id UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  author_id UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  last_run_at TIMESTAMPTZ,
  last_blog_id UUID REFERENCES public.blogs(id) ON DELETE SET NULL,
  last_status TEXT,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.daily_blog_settings (id, enabled)
VALUES (1, TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.daily_blog_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_date DATE NOT NULL,
  blog_id UUID REFERENCES public.blogs(id) ON DELETE SET NULL,
  topic TEXT,
  cover_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'skipped', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_blog_runs_date ON public.daily_blog_runs(run_date DESC);

ALTER TABLE public.daily_blog_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_blog_runs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_blog_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_blog_runs TO service_role;
GRANT SELECT ON public.daily_blog_settings TO authenticated;
GRANT SELECT ON public.daily_blog_runs TO authenticated;
