-- ============================================
-- OS → CI → TI FLOW (Order Summary / Customer Invoice / Tax Invoice)
-- Date: 2025-12-26
-- Purpose:
--   - Add PAYMENT_AWAITING lead status (if enum exists)
--   - Add shared invoice series counters (OS/CI/TI share same suffix per lead)
--   - Add invoice_type + visibility flags
--   - Add invoice_documents (versioned stored docs) + invoice_edit_logs (audit)
-- ============================================

-- 1) Lead status: add PAYMENT_AWAITING (enum-based installs)
-- NOTE: Keep the DO block free of inline comments because some SQL runners incorrectly
-- split/parse DO $$ ... $$ blocks when comments appear inside them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'lead_status'
        AND e.enumlabel = 'PAYMENT_AWAITING'
    ) THEN
      EXECUTE 'ALTER TYPE lead_status ADD VALUE ''PAYMENT_AWAITING''';
    END IF;
  END IF;
END $$;

-- 2) service_leads: persist shared suffix per lead + lock timestamp
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_series_year INTEGER;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_series_month INTEGER;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_series_seq INTEGER;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS billing_locked_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_service_leads_invoice_series
  ON service_leads(invoice_series_year, invoice_series_month, invoice_series_seq);

-- 3) invoices: invoice_type + suffix + visibility flags
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(30) DEFAULT 'TAX_INVOICE';
-- ORDER_SUMMARY | CUSTOMER_INVOICE | TAX_INVOICE

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS series_year INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS series_month INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS series_seq INTEGER;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS visible_to_customer BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS show_gst_breakup BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_invoices_lead_type ON invoices(lead_id, invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_series ON invoices(series_year, series_month, series_seq);

-- 4) Shared counter: invoice_series_counters + next_invoice_series_seq()
CREATE TABLE IF NOT EXISTS invoice_series_counters (
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (year, month)
);

CREATE OR REPLACE FUNCTION next_invoice_series_seq(p_year INTEGER, p_month INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  INSERT INTO invoice_series_counters(year, month, last_seq, updated_at)
  VALUES (p_year, p_month, 1, NOW())
  ON CONFLICT (year, month)
  DO UPDATE SET
    last_seq = invoice_series_counters.last_seq + 1,
    updated_at = NOW()
  RETURNING last_seq INTO v_seq;

  RETURN v_seq;
END;
$$;

-- 5) Versioned documents: invoice_documents
CREATE TABLE IF NOT EXISTS invoice_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  doc_type VARCHAR(30) NOT NULL, -- ORDER_SUMMARY | CUSTOMER_INVOICE | TAX_INVOICE | RECEIPT
  doc_number VARCHAR(50), -- OS-YYYY-MM-#### / CI-... / TI-...
  version INTEGER NOT NULL DEFAULT 1,
  storage_path TEXT,
  public_url TEXT,
  document_type VARCHAR(20) DEFAULT 'HTML', -- HTML / PDF
  snapshot JSONB DEFAULT '{}'::jsonb,
  checksum TEXT,
  generated_by UUID REFERENCES users_login(id),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (invoice_id, doc_type, version)
);

CREATE INDEX IF NOT EXISTS idx_invoice_documents_invoice_id ON invoice_documents(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_documents_doc_type ON invoice_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_invoice_documents_doc_number ON invoice_documents(doc_number);

-- 6) Edit logs: invoice_edit_logs (append-only audit)
CREATE TABLE IF NOT EXISTS invoice_edit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(30) NOT NULL, -- service_leads | invoices | payment_transactions | invoice_documents
  entity_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  changed_by UUID REFERENCES users_login(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_edit_logs_entity ON invoice_edit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_invoice_edit_logs_changed_at ON invoice_edit_logs(changed_at);

DO $$
BEGIN
  RAISE NOTICE '✅ OS→CI→TI flow schema added: invoice_series_counters, invoice_documents, invoice_edit_logs, new invoice fields, lead series fields.';
END $$;


