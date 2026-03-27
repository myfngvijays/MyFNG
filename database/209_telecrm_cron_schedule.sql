-- =====================================================
-- Migration: Schedule TeleCRM auto-push cron via pg_cron + pg_net
-- Runs every 2 hours, calls /api/cron/telecrm-push
-- 
-- Prerequisites:
--   1. Enable pg_cron  extension in Supabase Dashboard → Database → Extensions
--   2. Enable pg_net   extension in Supabase Dashboard → Database → Extensions
--   3. Set CRON_SECRET env var on your deployment (Vercel / hosting)
--   4. Replace 'YOUR_CRON_SECRET_HERE' below with the same secret value
--   5. Replace the URL if your production domain differs from https://myfng.in
-- =====================================================

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove old schedule if exists (safe re-run)
SELECT cron.unschedule('telecrm-auto-push')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'telecrm-auto-push'
);

-- Schedule: every 2 hours, call the Next.js cron endpoint
SELECT cron.schedule(
  'telecrm-auto-push',          -- job name
  '0 */2 * * *',                -- every 2 hours at minute 0
  $$
  SELECT net.http_get(
    url     := 'https://myfng.in/api/cron/telecrm-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET_HERE'
    )
  );
  $$
);

DO $$
BEGIN
  RAISE NOTICE '✅ telecrm-auto-push cron scheduled (every 2 hours)';
END $$;
