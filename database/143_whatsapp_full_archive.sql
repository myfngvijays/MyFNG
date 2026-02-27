-- ============================================
-- WhatsApp full archival tables
-- Purpose: store all outbound/inbound/status payloads
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_message_id VARCHAR(255),
  direction VARCHAR(20) NOT NULL, -- OUTBOUND | INBOUND | STATUS
  message_type VARCHAR(50), -- text, template, image, document, interactive, status, unknown
  lead_id UUID REFERENCES service_leads(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  sender_phone VARCHAR(30),
  recipient_phone VARCHAR(30),
  template_name VARCHAR(255),
  template_language VARCHAR(20),
  text_body TEXT,
  media_url TEXT,
  media_mime_type VARCHAR(120),
  media_caption TEXT,
  status VARCHAR(50),
  status_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users_login(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_provider_message_id
  ON whatsapp_messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_lead_id
  ON whatsapp_messages(lead_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_invoice_id
  ON whatsapp_messages(invoice_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction
  ON whatsapp_messages(direction);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status
  ON whatsapp_messages(status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at
  ON whatsapp_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) DEFAULT 'messages',
  payload JSONB NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  process_status VARCHAR(30) DEFAULT 'RECEIVED',
  process_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_received_at
  ON whatsapp_webhook_events(received_at DESC);
