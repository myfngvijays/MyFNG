-- Competitor Intel crawl via Supabase Cronon (pg_cron → pg_net → /api/cron/competitor-seo).
-- Every 6 hours. Vercel cron is the backup.
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
    WHERE jobname IN ('competitor-seo-monitor')
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'Unscheduled % (jobid=%)', r.jobname, r.jobid;
  END LOOP;
END $$;

SELECT cron.schedule(
  'competitor-seo-monitor',
  '20 */6 * * *',
  $$
  SELECT net.http_get(
    url := 'https://myfng.in/api/cron/competitor-seo',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    timeout_milliseconds := 180000
  );
  $$
);

SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'competitor-seo-monitor';
