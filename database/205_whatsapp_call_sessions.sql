-- ============================================
-- WhatsApp call signaling/session tables
-- ============================================

CREATE TABLE IF NOT EXISTS public.whatsapp_call_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_log_id UUID NOT NULL REFERENCES public.whatsapp_call_logs(id) ON DELETE CASCADE,
  provider_call_id VARCHAR(255),
  provider_session_id VARCHAR(255),
  offer_sdp TEXT,
  answer_sdp TEXT,
  offer_sdp_type VARCHAR(20),
  answer_sdp_type VARCHAR(20),
  session_state VARCHAR(40) NOT NULL DEFAULT 'NEGOTIATING',
  asterisk_channel_id VARCHAR(255),
  asterisk_bridge_id VARCHAR(255),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_call_sessions_provider_session_id
  ON public.whatsapp_call_sessions(provider_session_id)
  WHERE provider_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_sessions_call_log_id
  ON public.whatsapp_call_sessions(call_log_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_sessions_provider_call_id
  ON public.whatsapp_call_sessions(provider_call_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_sessions_state
  ON public.whatsapp_call_sessions(session_state);

CREATE TABLE IF NOT EXISTS public.whatsapp_call_ice_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.whatsapp_call_sessions(id) ON DELETE CASCADE,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  candidate TEXT NOT NULL,
  sdp_mid VARCHAR(100),
  sdp_mline_index INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_ice_candidates_session_id
  ON public.whatsapp_call_ice_candidates(session_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_ice_candidates_created_at
  ON public.whatsapp_call_ice_candidates(created_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_call_control_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_log_id UUID NOT NULL REFERENCES public.whatsapp_call_logs(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.whatsapp_call_sessions(id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL,
  action_status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
  requested_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_control_audit_call_log_id
  ON public.whatsapp_call_control_audit(call_log_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_control_audit_session_id
  ON public.whatsapp_call_control_audit(session_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_control_audit_action
  ON public.whatsapp_call_control_audit(action);

CREATE INDEX IF NOT EXISTS idx_whatsapp_call_control_audit_created_at
  ON public.whatsapp_call_control_audit(created_at DESC);

-- Enable RLS
ALTER TABLE IF EXISTS public.whatsapp_call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.whatsapp_call_ice_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.whatsapp_call_control_audit ENABLE ROW LEVEL SECURITY;

-- -----------------------------------
-- whatsapp_call_sessions policies
-- -----------------------------------
DROP POLICY IF EXISTS whatsapp_call_sessions_select_ops ON public.whatsapp_call_sessions;
DROP POLICY IF EXISTS whatsapp_call_sessions_insert_ops ON public.whatsapp_call_sessions;
DROP POLICY IF EXISTS whatsapp_call_sessions_update_ops ON public.whatsapp_call_sessions;

CREATE POLICY whatsapp_call_sessions_select_ops
ON public.whatsapp_call_sessions
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

CREATE POLICY whatsapp_call_sessions_insert_ops
ON public.whatsapp_call_sessions
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
);

CREATE POLICY whatsapp_call_sessions_update_ops
ON public.whatsapp_call_sessions
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
-- whatsapp_call_ice_candidates policies
-- -----------------------------------
DROP POLICY IF EXISTS whatsapp_call_ice_candidates_select_ops ON public.whatsapp_call_ice_candidates;
DROP POLICY IF EXISTS whatsapp_call_ice_candidates_insert_ops ON public.whatsapp_call_ice_candidates;

CREATE POLICY whatsapp_call_ice_candidates_select_ops
ON public.whatsapp_call_ice_candidates
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

CREATE POLICY whatsapp_call_ice_candidates_insert_ops
ON public.whatsapp_call_ice_candidates
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
);

-- -----------------------------------
-- whatsapp_call_control_audit policies
-- -----------------------------------
DROP POLICY IF EXISTS whatsapp_call_control_audit_select_ops ON public.whatsapp_call_control_audit;
DROP POLICY IF EXISTS whatsapp_call_control_audit_insert_ops ON public.whatsapp_call_control_audit;
DROP POLICY IF EXISTS whatsapp_call_control_audit_update_ops ON public.whatsapp_call_control_audit;

CREATE POLICY whatsapp_call_control_audit_select_ops
ON public.whatsapp_call_control_audit
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

CREATE POLICY whatsapp_call_control_audit_insert_ops
ON public.whatsapp_call_control_audit
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
);

CREATE POLICY whatsapp_call_control_audit_update_ops
ON public.whatsapp_call_control_audit
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

-- Realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_call_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_call_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_call_ice_candidates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_call_ice_candidates;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_call_control_audit'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_call_control_audit;
  END IF;
END $$;
