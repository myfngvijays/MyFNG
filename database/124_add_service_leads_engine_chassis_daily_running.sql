-- =====================================================
-- 124: service_leads - add engine/chassis/daily running KM
-- Purpose:
--  - Allow workshop advisor/admin to store vehicle identifiers and daily running.
-- =====================================================

BEGIN;

ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS engine_no TEXT,
  ADD COLUMN IF NOT EXISTS chassis_no TEXT,
  ADD COLUMN IF NOT EXISTS daily_running_km INTEGER;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ 124 applied: service_leads now has engine_no, chassis_no, daily_running_km';
END $$;

