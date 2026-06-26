-- 220_push_firebase_config.sql
-- Editable Firebase / FCM configuration for Push Notification Management admin console.

CREATE TABLE IF NOT EXISTS public.push_firebase_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT NOT NULL DEFAULT 'default' UNIQUE,
  project_id TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  auth_domain TEXT NOT NULL DEFAULT '',
  storage_bucket TEXT NOT NULL DEFAULT '',
  messaging_sender_id TEXT NOT NULL DEFAULT '',
  app_id TEXT NOT NULL DEFAULT '',
  measurement_id TEXT NOT NULL DEFAULT '',
  client_email TEXT NOT NULL DEFAULT '',
  private_key TEXT NOT NULL DEFAULT '',
  android_package TEXT NOT NULL DEFAULT 'com.myfng.app',
  ios_bundle_id TEXT NOT NULL DEFAULT 'com.myfng.app',
  android_default_channel TEXT NOT NULL DEFAULT 'default',
  apns_environment TEXT NOT NULL DEFAULT 'production',
  default_icon_url TEXT NOT NULL DEFAULT '',
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  use_db_credentials BOOLEAN NOT NULL DEFAULT false,
  admin_notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL
);

ALTER TABLE public.push_firebase_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_firebase_config_admin_select" ON public.push_firebase_config;
CREATE POLICY "push_firebase_config_admin_select"
  ON public.push_firebase_config
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

DROP POLICY IF EXISTS "push_firebase_config_super_admin_write" ON public.push_firebase_config;
CREATE POLICY "push_firebase_config_super_admin_write"
  ON public.push_firebase_config
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

GRANT SELECT ON public.push_firebase_config TO authenticated;

INSERT INTO public.push_firebase_config (
  config_key,
  project_id,
  api_key,
  auth_domain,
  storage_bucket,
  messaging_sender_id,
  app_id,
  measurement_id,
  android_package,
  ios_bundle_id,
  android_default_channel,
  apns_environment,
  push_enabled,
  use_db_credentials,
  admin_notes
)
VALUES (
  'default',
  'myfng-d863c',
  'AIzaSyAB1Sp4dBcnXchGMvQ0KWjA7jpTHYRPXYg',
  'myfng-d863c.firebaseapp.com',
  'myfng-d863c.firebasestorage.app',
  '455279370834',
  '1:455279370834:ios:38d95771254f40a5e7b58b',
  '',
  'com.myfng.app',
  'com.myfng.app',
  'default',
  'production',
  true,
  false,
  'Paste Firebase service account email + private key below and enable "Use saved credentials" to override server .env without redeploying.'
)
ON CONFLICT (config_key) DO NOTHING;

-- Additional editable notification settings
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  ('fcm_default_title_prefix', 'MyFNG', 'STRING', 'NOTIFICATIONS', 'Optional prefix for admin broadcast titles', 'MyFNG', true),
  ('fcm_delivery_protocol', 'FCM HTTP v1', 'STRING', 'NOTIFICATIONS', 'Push delivery protocol label', 'FCM HTTP v1', false)
ON CONFLICT (setting_key) DO NOTHING;
