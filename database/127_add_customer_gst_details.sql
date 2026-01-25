-- =====================================================
-- 127: Optional customer GST details (GST-registered)
-- Purpose:
--  - Store GSTIN/legal name/billing address/state code for registered customers
--  - Snapshot details on invoices (Tax Invoice)
-- =====================================================

BEGIN;

ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS customer_gstin TEXT,
  ADD COLUMN IF NOT EXISTS customer_legal_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_billing_address TEXT,
  ADD COLUMN IF NOT EXISTS customer_billing_state_code VARCHAR(10);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_gstin TEXT,
  ADD COLUMN IF NOT EXISTS customer_legal_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_billing_address TEXT,
  ADD COLUMN IF NOT EXISTS customer_billing_state_code VARCHAR(10);

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ 127 applied: customer GST details added to service_leads + invoices';
END $$;

