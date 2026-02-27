-- ============================================
-- WhatsApp templates master table
-- Purpose: Admin-managed templates for WhatsApp sends
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_name VARCHAR(150) NOT NULL UNIQUE,
  display_name VARCHAR(200),
  language_code VARCHAR(20) NOT NULL DEFAULT 'en',
  category VARCHAR(50) NOT NULL DEFAULT 'UTILITY',
  body_text TEXT NOT NULL,
  variable_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  example_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users_login(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_is_active
  ON whatsapp_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_language
  ON whatsapp_templates(language_code);
