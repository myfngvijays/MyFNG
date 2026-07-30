-- 269_whatsapp_env_meta_fields.sql
-- Extra Meta Cloud API fields editable from Super Admin WhatsApp Settings.

ALTER TABLE public.whatsapp_agents_env_config
  ADD COLUMN IF NOT EXISTS whatsapp_business_account_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp_app_secret TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp_webhook_verify_token TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.whatsapp_agents_env_config.whatsapp_business_account_id IS
  'Meta WhatsApp Business Account ID (WABA)';
COMMENT ON COLUMN public.whatsapp_agents_env_config.whatsapp_app_secret IS
  'Meta App Secret for webhook HMAC verification';
COMMENT ON COLUMN public.whatsapp_agents_env_config.whatsapp_webhook_verify_token IS
  'Meta webhook hub.verify_token';
