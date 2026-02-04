-- =====================================================
-- Migration: SARV aansh mapping by day + time window
-- Purpose: Allow day-of-week and time-only mapping
-- =====================================================

ALTER TABLE public.sarv_aansh_mappings
  ADD COLUMN IF NOT EXISTS day_of_week SMALLINT[],
  ADD COLUMN IF NOT EXISTS time_from TIME,
  ADD COLUMN IF NOT EXISTS time_to TIME;

-- day_of_week: 0=Sunday ... 6=Saturday
ALTER TABLE public.sarv_aansh_mappings
  ADD CONSTRAINT sarv_aansh_mappings_day_check
  CHECK (
    day_of_week IS NULL
    OR (array_length(day_of_week, 1) > 0 AND day_of_week <@ ARRAY[0,1,2,3,4,5,6]::SMALLINT[])
  );

DO $$
BEGIN
  RAISE NOTICE '✅ SARV mapping supports day/time windows now';
END $$;
