-- ============================================
-- WhatsApp Cloud API message tracking extension
-- Purpose: store provider message IDs + webhook metadata
-- ============================================

ALTER TABLE invoice_sharing_logs
  ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS message_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS template_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS webhook_payload JSONB;

CREATE INDEX IF NOT EXISTS idx_invoice_sharing_logs_provider_message_id
  ON invoice_sharing_logs(provider_message_id);

CREATE INDEX IF NOT EXISTS idx_invoice_sharing_logs_message_type
  ON invoice_sharing_logs(message_type);

CREATE INDEX IF NOT EXISTS idx_invoice_sharing_logs_template_name
  ON invoice_sharing_logs(template_name);
