-- Scheduled push campaigns via Supabase Cronon (pg_cron → pg_net).
-- Vercel cron /api/cron/scheduled-push was not firing, so queued campaigns stayed "scheduled".
-- Run in Supabase SQL Editor. Replace YOUR_CRON_SECRET with the real CRON_SECRET before running.
-- Do not commit the real secret.
-- Every 5 minutes. The route also skips campaigns more than 6 hours overdue.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT jobid, jobname
    FROM cron.job
    WHERE jobname IN ('scheduled-push-campaigns')
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'Unscheduled % (jobid=%)', r.jobname, r.jobid;
  END LOOP;
END $$;

SELECT cron.schedule(
  'scheduled-push-campaigns',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://myfng.in/api/cron/scheduled-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    timeout_milliseconds := 120000
  );
  $$
);

SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'scheduled-push-campaigns';
