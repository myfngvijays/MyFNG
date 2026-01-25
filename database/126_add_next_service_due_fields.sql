-- =====================================================
-- 126: service_leads - add next service due fields
-- Purpose:
--  - Store Next Service KM (auto: pickup odometer + 10000; editable)
--  - Store Next Service Date (auto: based on daily_running_km; editable)
-- =====================================================

BEGIN;

ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS next_service_km INTEGER,
  ADD COLUMN IF NOT EXISTS next_service_date DATE;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ 126 applied: service_leads now has next_service_km, next_service_date';
END $$;

