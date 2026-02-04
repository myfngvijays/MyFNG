-- =====================================================
-- Migration: Allow RSA_MANAGER mappings without telecaller_id
-- Purpose: Make telecaller_id nullable for non-telecaller mappings
-- =====================================================

ALTER TABLE public.sarv_aansh_mappings
  ALTER COLUMN telecaller_id DROP NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '✅ telecaller_id is now nullable for sarv_aansh_mappings';
END $$;
