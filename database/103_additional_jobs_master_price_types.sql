-- =====================================================
-- 103: Additional Jobs Master - Price Types
-- Purpose:
--  - Rename default_price -> oem_price
--  - Add oes_price and labour_price
-- =====================================================

BEGIN;

DO $$
BEGIN
  -- Rename default_price -> oem_price (only if needed)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'additional_jobs_master'
      AND column_name = 'default_price'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'additional_jobs_master'
      AND column_name = 'oem_price'
  ) THEN
    ALTER TABLE public.additional_jobs_master RENAME COLUMN default_price TO oem_price;
  END IF;

  -- Add missing columns (best-effort, idempotent)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'additional_jobs_master'
      AND column_name = 'oes_price'
  ) THEN
    ALTER TABLE public.additional_jobs_master
      ADD COLUMN oes_price NUMERIC(12,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'additional_jobs_master'
      AND column_name = 'labour_price'
  ) THEN
    ALTER TABLE public.additional_jobs_master
      ADD COLUMN labour_price NUMERIC(12,2) NOT NULL DEFAULT 0;
  END IF;

  -- Ensure oem_price exists and is NOT NULL DEFAULT 0 (in case rename didn't happen)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'additional_jobs_master'
      AND column_name = 'oem_price'
  ) THEN
    ALTER TABLE public.additional_jobs_master
      ALTER COLUMN oem_price SET DEFAULT 0;
    UPDATE public.additional_jobs_master SET oem_price = 0 WHERE oem_price IS NULL;
    ALTER TABLE public.additional_jobs_master
      ALTER COLUMN oem_price SET NOT NULL;
  END IF;
END $$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ additional_jobs_master price types applied (OEM/OES/Labour)';
END $$;


