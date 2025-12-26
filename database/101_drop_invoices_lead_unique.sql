-- ============================================
-- Drop legacy UNIQUE(lead_id) on invoices
-- Needed for OS/CI/TI multi-document flow (multiple invoices per lead)
-- ============================================

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_lead_id_unique;

-- Some installs use a unique index instead of constraint; drop if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'invoices'
      AND indexname = 'idx_invoices_lead_id_unique'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS public.idx_invoices_lead_id_unique';
  END IF;
END $$;


