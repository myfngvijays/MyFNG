-- ============================================
-- WhatsApp calling tables + RLS + realtime
-- ============================================

CREATE TABLE IF NOT EXISTS public.whatsapp_call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_call_id VARCHAR(255),
  provider_conversation_id VARCHAR(255),
  direction VARCHAR(30) NOT NULL, -- INBOUND | OUTBOUND | CALLBACK_REQUEST | CALLBACK
  call_status VARCHAR(40) NOT NULL, -- INITIATED | RINGING | ACCEPTED | ENDED | MISSED | REJECTED | FAILED
  customer_phone VARCHAR(30) NOT NULL,
  lead_id UUID REFERENCES public.service_leads(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  callback_requested BOOLEAN NOT NULL DEFAULT FALSE,
  recording_available BOOLEAN NOT NULL DEFAULT FALSE,
  recording_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_call_logs_provider_call_id
  ON public.whatsapp_call_logs(provider_call_id)
  WHERE provider_call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_logs_customer_phone
  ON public.whatsapp_call_logs(customer_phone);

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_logs_direction
  ON public.whatsapp_call_logs(direction);

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_logs_status
  ON public.whatsapp_call_logs(call_status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_logs_started_at
  ON public.whatsapp_call_logs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_logs_created_at
  ON public.whatsapp_call_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_call_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_log_id UUID REFERENCES public.whatsapp_call_logs(id) ON DELETE CASCADE,
  provider_call_id VARCHAR(255),
  provider_recording_id VARCHAR(255),
  recording_url TEXT,
  recording_proxy_path TEXT,
  mime_type VARCHAR(120),
  duration_seconds INTEGER,
  size_bytes BIGINT,
  available_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_call_recordings_provider_recording_id
  ON public.whatsapp_call_recordings(provider_recording_id)
  WHERE provider_recording_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_recordings_call_log_id
  ON public.whatsapp_call_recordings(call_log_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_recordings_provider_call_id
  ON public.whatsapp_call_recordings(provider_call_id);

-- Enable RLS
ALTER TABLE IF EXISTS public.whatsapp_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.whatsapp_call_recordings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------
-- whatsapp_call_logs policies
-- -----------------------------------
DROP POLICY IF EXISTS whatsapp_call_logs_select_ops ON public.whatsapp_call_logs;
DROP POLICY IF EXISTS whatsapp_call_logs_insert_ops ON public.whatsapp_call_logs;
DROP POLICY IF EXISTS whatsapp_call_logs_update_ops ON public.whatsapp_call_logs;

CREATE POLICY whatsapp_call_logs_select_ops
ON public.whatsapp_call_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN (
        'SUPER_ADMIN',
        'SUB_ADMIN',
        'RSA_MANAGER',
        'TELECALLER',
        'CUSTOMER_SERVICE_EXECUTIVE',
        'WORKSHOP_ADMIN',
        'WORKSHOP_SUPERVISOR',
        'BILLING_SPECIALIST'
      )
  )
);

CREATE POLICY whatsapp_call_logs_insert_ops
ON public.whatsapp_call_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN (
        'SUPER_ADMIN',
        'SUB_ADMIN',
        'RSA_MANAGER',
        'TELECALLER',
        'CUSTOMER_SERVICE_EXECUTIVE',
        'WORKSHOP_ADMIN',
        'WORKSHOP_SUPERVISOR',
        'BILLING_SPECIALIST'
      )
  )
  AND (created_by IS NULL OR created_by = auth.uid())
);

CREATE POLICY whatsapp_call_logs_update_ops
ON public.whatsapp_call_logs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN (
        'SUPER_ADMIN',
        'SUB_ADMIN',
        'RSA_MANAGER',
        'TELECALLER',
        'CUSTOMER_SERVICE_EXECUTIVE',
        'WORKSHOP_ADMIN',
        'WORKSHOP_SUPERVISOR',
        'BILLING_SPECIALIST'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN (
        'SUPER_ADMIN',
        'SUB_ADMIN',
        'RSA_MANAGER',
        'TELECALLER',
        'CUSTOMER_SERVICE_EXECUTIVE',
        'WORKSHOP_ADMIN',
        'WORKSHOP_SUPERVISOR',
        'BILLING_SPECIALIST'
      )
  )
);

-- -----------------------------------
-- whatsapp_call_recordings policies
-- -----------------------------------
DROP POLICY IF EXISTS whatsapp_call_recordings_select_ops ON public.whatsapp_call_recordings;
DROP POLICY IF EXISTS whatsapp_call_recordings_insert_admin ON public.whatsapp_call_recordings;
DROP POLICY IF EXISTS whatsapp_call_recordings_update_admin ON public.whatsapp_call_recordings;

CREATE POLICY whatsapp_call_recordings_select_ops
ON public.whatsapp_call_recordings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN (
        'SUPER_ADMIN',
        'SUB_ADMIN',
        'RSA_MANAGER',
        'TELECALLER',
        'CUSTOMER_SERVICE_EXECUTIVE',
        'WORKSHOP_ADMIN',
        'WORKSHOP_SUPERVISOR',
        'BILLING_SPECIALIST'
      )
  )
);

CREATE POLICY whatsapp_call_recordings_insert_admin
ON public.whatsapp_call_recordings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

CREATE POLICY whatsapp_call_recordings_update_admin
ON public.whatsapp_call_recordings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

-- Realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_call_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_call_logs;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_call_recordings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_call_recordings;
  END IF;
END $$;
