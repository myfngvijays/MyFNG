-- 268_whatsapp_agents_env_config.sql
-- Editable WhatsApp Agents credentials for Bot Flow admin (Super Admin).

CREATE TABLE IF NOT EXISTS public.whatsapp_agents_env_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT NOT NULL DEFAULT 'default' UNIQUE,
  openai_api_key TEXT NOT NULL DEFAULT '',
  whatsapp_access_token TEXT NOT NULL DEFAULT '',
  whatsapp_phone_number_id TEXT NOT NULL DEFAULT '',
  whatsapp_api_url TEXT NOT NULL DEFAULT 'https://graph.facebook.com/v21.0',
  cron_secret TEXT NOT NULL DEFAULT '',
  telecrm_webhook_secret TEXT NOT NULL DEFAULT '',
  use_db_credentials BOOLEAN NOT NULL DEFAULT false,
  admin_notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL
);

ALTER TABLE public.whatsapp_agents_env_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_agents_env_config_admin_select" ON public.whatsapp_agents_env_config;
CREATE POLICY "whatsapp_agents_env_config_admin_select"
  ON public.whatsapp_agents_env_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      INNER JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
        AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
    )
  );

DROP POLICY IF EXISTS "whatsapp_agents_env_config_super_admin_write" ON public.whatsapp_agents_env_config;
CREATE POLICY "whatsapp_agents_env_config_super_admin_write"
  ON public.whatsapp_agents_env_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      INNER JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
        AND r.role_code = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      INNER JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
        AND r.role_code = 'SUPER_ADMIN'
    )
  );

GRANT SELECT ON public.whatsapp_agents_env_config TO authenticated;

INSERT INTO public.whatsapp_agents_env_config (
  config_key,
  whatsapp_api_url,
  use_db_credentials,
  admin_notes
)
VALUES (
  'default',
  'https://graph.facebook.com/v21.0',
  false,
  'Enable "Use saved credentials" after filling keys below to override server .env without redeploying. SUPABASE_SERVICE_ROLE_KEY stays in server env only.'
)
ON CONFLICT (config_key) DO NOTHING;
