-- ============================================================
-- 121_manual_invoice_payment_fields.sql
-- Purpose: Add payment received fields to manual invoices
-- ============================================================

BEGIN;

ALTER TABLE public.manual_create_invoice
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(30),
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_notes TEXT;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ manual_create_invoice payment fields added successfully!';
END $$;

