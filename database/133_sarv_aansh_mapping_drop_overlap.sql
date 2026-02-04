-- =====================================================
-- Migration: Drop overlap constraint for SARV mappings
-- Purpose: Allow multiple day/time windows per aansh_id
-- =====================================================

ALTER TABLE public.sarv_aansh_mappings
  DROP CONSTRAINT IF EXISTS sarv_aansh_mappings_no_overlap;

DO $$
BEGIN
  RAISE NOTICE '✅ Dropped overlap constraint for sarv_aansh_mappings';
END $$;
