-- Daily AI blog via Supabase Cronon (pg_cron → pg_net → /api/cron/daily-blog).
-- Production jobs already live in Integrations → Cronon. Vercel cron is only a backup.
-- Hourly :30 UTC so admin-configured IST slot times (1-5 blogs/day) can all fire.
-- Run in Supabase SQL Editor. Replace YOUR_CRON_SECRET with the real CRON_SECRET.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT jobid, jobname
    FROM cron.job
    WHERE jobname IN ('daily-blog-auto-post', 'wa-daily-blog-auto-post')
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'Unscheduled % (jobid=%)', r.jobname, r.jobid;
  END LOOP;
END $$;

SELECT cron.schedule(
  'daily-blog-auto-post',
  '30 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://myfng.in/api/cron/daily-blog',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    timeout_milliseconds := 300000
  );
  $$
);

SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'daily-blog-auto-post';
