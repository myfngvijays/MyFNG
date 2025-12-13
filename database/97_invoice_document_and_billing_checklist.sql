shaya-- ============================================
-- INVOICE DOCUMENT STORAGE + BILLING CHECKLIST EXTENSIONS
-- Purpose:
--   - Store generated invoice document URL (HTML now; can upgrade to PDF later)
--   - Store billing finalization checklist snapshot for audit
--   - Update CSE follow-up trigger to new delivery status DELIVERED_TO_CUSTOMER
-- ============================================

-- 1) invoices: document URL + metadata
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_url TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_type VARCHAR(20) DEFAULT 'HTML'; -- HTML/PDF
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_generated_at TIMESTAMP WITH TIME ZONE;

-- 2) invoice_reviews: store checklist snapshot + stage
ALTER TABLE invoice_reviews ADD COLUMN IF NOT EXISTS checklist_data JSONB;
ALTER TABLE invoice_reviews ADD COLUMN IF NOT EXISTS review_stage VARCHAR(50);

-- 3) Update CSE follow-up trigger to fire on DELIVERED_TO_CUSTOMER
CREATE OR REPLACE FUNCTION set_cse_followup_due()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'DELIVERED_TO_CUSTOMER' AND OLD.status IS DISTINCT FROM 'DELIVERED_TO_CUSTOMER' THEN
    NEW.cse_followup_due := true;
    NEW.cse_followup_due_at := NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_cse_followup_due ON service_leads;
CREATE TRIGGER trigger_set_cse_followup_due
  BEFORE UPDATE ON service_leads
  FOR EACH ROW
  EXECUTE FUNCTION set_cse_followup_due();


