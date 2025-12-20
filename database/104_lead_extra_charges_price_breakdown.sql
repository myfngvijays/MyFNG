-- =====================================================
-- 104: lead_extra_charges - Price breakdown + customer decision
-- Purpose:
--  - Add OEM / OES / Labour price columns per extra work request
--  - Allow customer to approve/reject and choose OEM/OES
--  - Keep legacy `amount` as computed total for compatibility
-- =====================================================

BEGIN;

DO $$
BEGIN
  -- Price breakdown
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lead_extra_charges' AND column_name='oem_price'
  ) THEN
    ALTER TABLE public.lead_extra_charges ADD COLUMN oem_price NUMERIC(12,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lead_extra_charges' AND column_name='oes_price'
  ) THEN
    ALTER TABLE public.lead_extra_charges ADD COLUMN oes_price NUMERIC(12,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lead_extra_charges' AND column_name='labour_price'
  ) THEN
    ALTER TABLE public.lead_extra_charges ADD COLUMN labour_price NUMERIC(12,2) NOT NULL DEFAULT 0;
  END IF;

  -- Customer-selected part type (OEM/OES). Advisor sets both prices; customer selects.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lead_extra_charges' AND column_name='part_price_type'
  ) THEN
    ALTER TABLE public.lead_extra_charges ADD COLUMN part_price_type VARCHAR(10) NOT NULL DEFAULT 'OEM';
  END IF;

  -- Customer decision tracking (if not already present from earlier migrations)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lead_extra_charges' AND column_name='customer_approved'
  ) THEN
    ALTER TABLE public.lead_extra_charges ADD COLUMN customer_approved BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lead_extra_charges' AND column_name='customer_approved_at'
  ) THEN
    ALTER TABLE public.lead_extra_charges ADD COLUMN customer_approved_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Backfill best-effort for existing rows:
-- If only legacy amount exists, treat it as OEM price (labour=0, OES=0).
UPDATE public.lead_extra_charges
SET
  oem_price = CASE WHEN oem_price = 0 AND amount IS NOT NULL AND amount > 0 THEN amount ELSE oem_price END,
  part_price_type = COALESCE(NULLIF(part_price_type, ''), 'OEM')
WHERE TRUE;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ 104 applied: lead_extra_charges now supports OEM/OES/Labour + customer decision';
END $$;

