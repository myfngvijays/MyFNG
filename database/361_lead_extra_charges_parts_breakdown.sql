-- =====================================================
-- 361: lead_extra_charges.parts_breakdown
-- Transparent pricing: list parts/labour used for additional work
-- Shape: [{ name, qty, unit_price, amount, kind? }]
-- =====================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lead_extra_charges'
      AND column_name = 'parts_breakdown'
  ) THEN
    ALTER TABLE public.lead_extra_charges
      ADD COLUMN parts_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.lead_extra_charges.parts_breakdown IS
  'Transparent pricing lines for additional work: [{name, qty, unit_price, amount, kind}]';

COMMIT;
