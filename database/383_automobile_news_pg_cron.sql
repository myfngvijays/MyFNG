  -- Automobile News: 10 original stories per IST day.
  -- 10:00, 10:30, 11:00, 11:30, 12:00, 12:30, 13:00, 13:30, 14:00, 14:30 IST.
  -- UTC cron */10 4-9 ticks every 10 minutes from 09:30 to 15:20 IST.
  -- The route skips ticks before 10:00 IST and fills the oldest empty slot.
-- Run in Supabase SQL Editor. Replace YOUR_CRON_SECRET with the real CRON_SECRET before running.
-- Do not commit the real secret.

  -- Optional pause flag for the blog panel. Safe to run more than once.
  ALTER TABLE public.daily_blog_settings
    ADD COLUMN IF NOT EXISTS news_enabled BOOLEAN NOT NULL DEFAULT TRUE;

  COMMENT ON COLUMN public.daily_blog_settings.news_enabled IS 'When false, /api/cron/automobile-news skips. Post now in the blog panel still works.';

  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

  DO $$
  DECLARE
    r RECORD;
  BEGIN
    FOR r IN
      SELECT jobid, jobname
      FROM cron.job
      WHERE jobname = 'automobile-news-auto-post'
    LOOP
      PERFORM cron.unschedule(r.jobid);
      RAISE NOTICE 'Unscheduled % (jobid=%)', r.jobname, r.jobid;
    END LOOP;
  END $$;

  SELECT cron.schedule(
    'automobile-news-auto-post',
    '*/10 4-9 * * *',
    $$
    SELECT net.http_get(
      url := 'https://myfng.in/api/cron/automobile-news',
      headers := jsonb_build_object(
        'Authorization', 'Bearer YOUR_CRON_SECRET'
      ),
      timeout_milliseconds := 300000
    );
    $$
  );

  SELECT jobid, jobname, schedule, active, command
  FROM cron.job
  WHERE jobname = 'automobile-news-auto-post';
