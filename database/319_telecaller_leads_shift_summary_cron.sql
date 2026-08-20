-- One-shot: schedule telecaller leads shift summary cron (7:00 PM IST daily).
-- Run in Supabase SQL Editor after deploying the API route.
-- Replace YOUR_CRON_SECRET with the real CRON_SECRET.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT jobid, jobname
    FROM cron.job
    WHERE jobname = 'wa-telecaller-leads-shift-summary'
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'wa-telecaller-leads-shift-summary',
  '30 13 * * *',
  $$
  SELECT net.http_get(
    url := 'https://myfng.in/api/cron/telecaller-leads-shift-summary?force=1',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    timeout_milliseconds := 120000
  );
  $$
);

SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'wa-telecaller-leads-shift-summary';
