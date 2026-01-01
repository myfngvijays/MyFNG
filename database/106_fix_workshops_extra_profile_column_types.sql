-- =====================================================
-- MIGRATION: Fix workshops extra profile column types
-- Purpose: Align column types with latest workshops schema
-- Notes:
-- - Safe to run on existing DB: only alters when current type differs.
-- - Converts booleans/numerics to text using ::text.
-- =====================================================

DO $$
BEGIN
  -- creadit_card_swap: boolean -> text (and remove default if any)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workshops'
      AND column_name = 'creadit_card_swap'
      AND data_type <> 'text'
  ) THEN
    EXECUTE 'ALTER TABLE public.workshops ALTER COLUMN creadit_card_swap TYPE text USING (creadit_card_swap::text)';
  END IF;
  EXECUTE 'ALTER TABLE public.workshops ALTER COLUMN creadit_card_swap DROP DEFAULT';

  -- engine_oil: boolean -> text
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workshops'
      AND column_name = 'engine_oil'
      AND data_type <> 'text'
  ) THEN
    EXECUTE 'ALTER TABLE public.workshops ALTER COLUMN engine_oil TYPE text USING (engine_oil::text)';
  END IF;
  EXECUTE 'ALTER TABLE public.workshops ALTER COLUMN engine_oil DROP DEFAULT';

  -- insurance_claim: boolean -> text
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workshops'
      AND column_name = 'insurance_claim'
      AND data_type <> 'text'
  ) THEN
    EXECUTE 'ALTER TABLE public.workshops ALTER COLUMN insurance_claim TYPE text USING (insurance_claim::text)';
  END IF;
  EXECUTE 'ALTER TABLE public.workshops ALTER COLUMN insurance_claim DROP DEFAULT';

  -- service_panel_issue: boolean -> text
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workshops'
      AND column_name = 'service_panel_issue'
      AND data_type <> 'text'
  ) THEN
    EXECUTE 'ALTER TABLE public.workshops ALTER COLUMN service_panel_issue TYPE text USING (service_panel_issue::text)';
  END IF;
  EXECUTE 'ALTER TABLE public.workshops ALTER COLUMN service_panel_issue DROP DEFAULT';

  -- retainer_fee: numeric -> text
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workshops'
      AND column_name = 'retainer_fee'
      AND data_type <> 'text'
  ) THEN
    EXECUTE 'ALTER TABLE public.workshops ALTER COLUMN retainer_fee TYPE text USING (retainer_fee::text)';
  END IF;
EXCEPTION
  WHEN undefined_column THEN
    -- Column doesn't exist in this DB, ignore.
    NULL;
END $$;


