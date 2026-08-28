-- 352_dlt_sms.sql
-- TRAI DLT SMS registry + gateway config for Super Admin (Jio TrueConnect-style).
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.dlt_sms_entity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL DEFAULT 'default' UNIQUE,
  pe_id TEXT NOT NULL DEFAULT '',
  pe_name TEXT NOT NULL DEFAULT '',
  brand_name TEXT NOT NULL DEFAULT 'MyFNG',
  operator TEXT NOT NULL DEFAULT 'JIO',
  portal_url TEXT NOT NULL DEFAULT 'https://trueconnect.jio.com',
  entity_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (entity_status IN ('APPROVED', 'PENDING', 'REJECTED', 'NOT_REGISTERED')),
  pan TEXT NOT NULL DEFAULT '',
  gstin TEXT NOT NULL DEFAULT '',
  registered_address TEXT NOT NULL DEFAULT '',
  admin_notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.dlt_sms_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  header TEXT NOT NULL,
  header_type TEXT NOT NULL DEFAULT 'TRANS'
    CHECK (header_type IN ('TRANS', 'PROMO', 'SEAMLESS')),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('APPROVED', 'PENDING', 'REJECTED')),
  dlt_header_id TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS dlt_sms_headers_header_upper_idx
  ON public.dlt_sms_headers (upper(header));

CREATE TABLE IF NOT EXISTS public.dlt_sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('CONSENT', 'CONTENT')),
  name TEXT NOT NULL,
  header_id UUID REFERENCES public.dlt_sms_headers(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'TRANSACTIONAL'
    CHECK (category IN ('TRANSACTIONAL', 'SERVICE_IMPLICIT', 'SERVICE_EXPLICIT', 'PROMOTIONAL')),
  template_text TEXT NOT NULL DEFAULT '',
  variables TEXT[] NOT NULL DEFAULT '{}',
  dlt_template_id TEXT NOT NULL DEFAULT '',
  provider_template_id TEXT NOT NULL DEFAULT '',
  event_key TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('APPROVED', 'PENDING', 'REJECTED')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS dlt_sms_templates_kind_status_idx
  ON public.dlt_sms_templates (kind, status);
CREATE INDEX IF NOT EXISTS dlt_sms_templates_event_key_idx
  ON public.dlt_sms_templates (event_key)
  WHERE event_key <> '';

CREATE TABLE IF NOT EXISTS public.dlt_sms_telemarketers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'MYFNG'
    CHECK (provider IN ('MYFNG', 'JIO', 'AIRTEL', 'VIL', 'BSNL', 'SMPP', 'HTTP')),
  tm_id TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  api_url TEXT NOT NULL DEFAULT '',
  default_header TEXT NOT NULL DEFAULT '',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  extra_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS dlt_sms_telemarketers_primary_idx
  ON public.dlt_sms_telemarketers (is_primary)
  WHERE is_primary = true;

CREATE TABLE IF NOT EXISTS public.dlt_sms_cta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cta_type TEXT NOT NULL DEFAULT 'URL'
    CHECK (cta_type IN ('URL', 'PHONE', 'SHORTCODE')),
  value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('APPROVED', 'PENDING', 'REJECTED')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS dlt_sms_cta_value_upper_idx
  ON public.dlt_sms_cta (cta_type, upper(value));

CREATE TABLE IF NOT EXISTS public.dlt_sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  template_id UUID REFERENCES public.dlt_sms_templates(id) ON DELETE SET NULL,
  header TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'FAILED'
    CHECK (status IN ('SENT', 'FAILED', 'PENDING')),
  provider_message_id TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dlt_sms_logs_created_idx
  ON public.dlt_sms_logs (created_at DESC);

ALTER TABLE public.dlt_sms_entity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dlt_sms_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dlt_sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dlt_sms_telemarketers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dlt_sms_cta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dlt_sms_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'dlt_sms_entity',
    'dlt_sms_headers',
    'dlt_sms_templates',
    'dlt_sms_telemarketers',
    'dlt_sms_cta',
    'dlt_sms_logs'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
         EXISTS (
           SELECT 1 FROM public.users_login ul
           INNER JOIN public.roles r ON r.id = ul.role_id
           WHERE ul.id = auth.uid()
             AND r.role_code IN (''SUPER_ADMIN'', ''SUB_ADMIN'')
         )
       )',
      t || '_admin_select', t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_super_admin_write', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (
         EXISTS (
           SELECT 1 FROM public.users_login ul
           INNER JOIN public.roles r ON r.id = ul.role_id
           WHERE ul.id = auth.uid()
             AND r.role_code = ''SUPER_ADMIN''
         )
       ) WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.users_login ul
           INNER JOIN public.roles r ON r.id = ul.role_id
           WHERE ul.id = auth.uid()
             AND r.role_code = ''SUPER_ADMIN''
         )
       )',
      t || '_super_admin_write', t
    );

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

INSERT INTO public.dlt_sms_entity (
  config_key,
  pe_id,
  pe_name,
  brand_name,
  operator,
  portal_url,
  entity_status,
  admin_notes
)
VALUES (
  'default',
  '12011707510150892690',
  'Rahul Yelligetti',
  'MyFNG',
  'JIO',
  'https://trueconnect.jio.com',
  'APPROVED',
  'PE approved on Jio TrueConnect. Register SMS header + content templates on the operator portal, then paste DLT IDs here before sending.'
)
ON CONFLICT (config_key) DO UPDATE
SET
  pe_id = CASE WHEN public.dlt_sms_entity.pe_id = '' THEN EXCLUDED.pe_id ELSE public.dlt_sms_entity.pe_id END,
  pe_name = CASE WHEN public.dlt_sms_entity.pe_name = '' THEN EXCLUDED.pe_name ELSE public.dlt_sms_entity.pe_name END,
  portal_url = CASE WHEN public.dlt_sms_entity.portal_url = '' THEN EXCLUDED.portal_url ELSE public.dlt_sms_entity.portal_url END,
  updated_at = NOW();
