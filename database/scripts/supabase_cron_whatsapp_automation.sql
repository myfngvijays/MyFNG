-- =============================================================================
-- Supabase Cron → MyFNG WhatsApp automation (+ system health)
-- Run in: Supabase Dashboard → SQL Editor
-- Auth:  Authorization: Bearer <CRON_SECRET>
-- Note: Each job is separate (no bundled job=all).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Unschedule previous versions of these jobs (ignore if missing)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT jobid, jobname
    FROM cron.job
    WHERE jobname LIKE 'wa-auto-%'
       OR jobname LIKE 'sys-health-alert-%'
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'Unscheduled % (jobid=%)', r.jobname, r.jobid;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- App uninstall probe (04:00 UTC ≈ 09:30 IST)
-- -----------------------------------------------------------------------------
SELECT cron.schedule(
  'wa-auto-app-uninstall-probe',
  '0 4 * * *',
  $$
  SELECT net.http_get(
    url := 'https://myfng.in/api/cron/whatsapp-automation?job=app-uninstall-probe',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    timeout_milliseconds := 120000
  );
  $$
);

-- -----------------------------------------------------------------------------
-- Incomplete booking (04:30 UTC ≈ 10:00 IST)
-- -----------------------------------------------------------------------------
SELECT cron.schedule(
  'wa-auto-booking-incomplete',
  '30 4 * * *',
  $$
  SELECT net.http_get(
    url := 'https://myfng.in/api/cron/whatsapp-automation?job=booking-incomplete',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    timeout_milliseconds := 120000
  );
  $$
);

-- -----------------------------------------------------------------------------
-- Admin daily summary (04:45 UTC ≈ 10:15 IST)
-- -----------------------------------------------------------------------------
SELECT cron.schedule(
  'wa-auto-admin-daily-summary',
  '45 4 * * *',
  $$
  SELECT net.http_get(
    url := 'https://myfng.in/api/cron/whatsapp-automation?job=admin-daily-summary&force=1',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    timeout_milliseconds := 120000
  );
  $$
);

-- -----------------------------------------------------------------------------
-- Membership expiring (05:00 UTC ≈ 10:30 IST)
-- -----------------------------------------------------------------------------
SELECT cron.schedule(
  'wa-auto-membership-expiring',
  '0 5 * * *',
  $$
  SELECT net.http_get(
    url := 'https://myfng.in/api/cron/whatsapp-automation?job=membership-expiring',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    timeout_milliseconds := 120000
  );
  $$
);

-- -----------------------------------------------------------------------------
-- Service due — Mondays only (05:15 UTC ≈ 10:45 IST)
-- -----------------------------------------------------------------------------
SELECT cron.schedule(
  'wa-auto-service-due',
  '15 5 * * 1',
  $$
  SELECT net.http_get(
    url := 'https://myfng.in/api/cron/whatsapp-automation?job=service-due',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    timeout_milliseconds := 120000
  );
  $$
);

-- -----------------------------------------------------------------------------
-- System health alert WhatsApp (09:00 & 21:00 IST)
-- 03:30 UTC = 09:00 IST · 15:30 UTC = 21:00 IST
-- -----------------------------------------------------------------------------
SELECT cron.schedule(
  'sys-health-alert-morning',
  '30 3 * * *',
  $$
  SELECT net.http_get(
    url := 'https://myfng.in/api/cron/system-health-alert?slot=morning',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    timeout_milliseconds := 120000
  );
  $$
);

SELECT cron.schedule(
  'sys-health-alert-evening',
  '30 15 * * *',
  $$
  SELECT net.http_get(
    url := 'https://myfng.in/api/cron/system-health-alert?slot=evening',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    timeout_milliseconds := 120000
  );
  $$
);

-- -----------------------------------------------------------------------------
-- Verify
-- -----------------------------------------------------------------------------
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'wa-auto-%'
   OR jobname LIKE 'sys-health-alert-%'
ORDER BY jobname;

-- After a run, check responses:
-- SELECT id, status_code, left(content::text, 500) AS body, created
-- FROM net._http_response
-- ORDER BY created DESC
-- LIMIT 10;
