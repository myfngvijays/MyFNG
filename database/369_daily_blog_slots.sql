-- Configurable daily blog count + IST post times from Digital Marketing admin.
-- Default stays 1 post at 10:00 IST. Cron still hits /api/cron/daily-blog hourly.

ALTER TABLE public.daily_blog_settings
  ADD COLUMN IF NOT EXISTS posts_per_day INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS post_times JSONB NOT NULL DEFAULT '["10:00"]'::jsonb;

ALTER TABLE public.daily_blog_settings
  DROP CONSTRAINT IF EXISTS daily_blog_settings_posts_per_day_check;
ALTER TABLE public.daily_blog_settings
  ADD CONSTRAINT daily_blog_settings_posts_per_day_check CHECK (posts_per_day BETWEEN 1 AND 5);

ALTER TABLE public.daily_blog_runs
  ADD COLUMN IF NOT EXISTS slot_index INT NOT NULL DEFAULT 1;

ALTER TABLE public.daily_blog_runs
  DROP CONSTRAINT IF EXISTS daily_blog_runs_run_date_key;

DROP INDEX IF EXISTS daily_blog_runs_date_slot_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS daily_blog_runs_date_slot_uidx
  ON public.daily_blog_runs (run_date, slot_index);

UPDATE public.daily_blog_settings
SET
  posts_per_day = COALESCE(posts_per_day, 1),
  post_times = COALESCE(post_times, '["10:00"]'::jsonb),
  updated_at = NOW()
WHERE id = 1;

COMMENT ON COLUMN public.daily_blog_settings.posts_per_day IS 'How many AI blogs to auto-publish each IST day (1-5).';
COMMENT ON COLUMN public.daily_blog_settings.post_times IS 'IST HH:MM times for each daily slot, e.g. ["10:00","14:00","18:00"].';
