-- Append-only log for every daily-blog cron tick, skip, fail, and admin action.
-- Admin panel: Digital Marketing → Auto-post logs / Super Admin → Daily Blogs.

CREATE TABLE IF NOT EXISTS public.daily_blog_cron_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'skipped', 'failed', 'info')),
  reason TEXT,
  slot_index INT,
  run_date DATE,
  topic TEXT,
  blog_id UUID REFERENCES public.blogs(id) ON DELETE SET NULL,
  blog_title TEXT,
  error TEXT,
  duration_ms INT,
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_daily_blog_cron_logs_created
  ON public.daily_blog_cron_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_blog_cron_logs_run_date
  ON public.daily_blog_cron_logs (run_date DESC, created_at DESC);

ALTER TABLE public.daily_blog_cron_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.daily_blog_cron_logs TO service_role;
GRANT SELECT ON public.daily_blog_cron_logs TO authenticated;

COMMENT ON TABLE public.daily_blog_cron_logs IS
  'Every daily-blog cron hit, skip, fail, catch-up, and admin Post now / schedule change.';
