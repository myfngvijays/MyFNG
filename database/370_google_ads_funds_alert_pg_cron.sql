-- Google Ads low-funds WhatsApp via Supabase Cronon (pg_cron → pg_net).
-- Every 3 hours UTC. Vercel cron is a backup.
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
    WHERE jobname IN ('google-ads-funds-alert', 'wa-google-ads-funds-alert')
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'Unscheduled % (jobid=%)', r.jobname, r.jobid;
  END LOOP;
END $$;

SELECT cron.schedule(
  'google-ads-funds-alert',
  '0 */3 * * *',
  $$
  SELECT net.http_get(
    url := 'https://myfng.in/api/cron/google-ads-funds-alert',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    timeout_milliseconds := 60000
  );
  $$
);

SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'google-ads-funds-alert';
