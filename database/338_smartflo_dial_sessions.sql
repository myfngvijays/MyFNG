-- =====================================================
-- Smartflo live dial sessions (click-to-call UI sync)
-- Status updates via /api/webhooks/smartflo mid-call events
-- =====================================================

CREATE TABLE IF NOT EXISTS public.smartflo_dial_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telecaller_id UUID,
  lead_id UUID REFERENCES public.service_leads(id) ON DELETE SET NULL,
  call_log_id UUID REFERENCES public.telecaller_call_logs(id) ON DELETE SET NULL,
  agent_phone TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  did_number TEXT,
  -- INITIATED | RINGING | ANSWERED | ENDED | MISSED | FAILED
  status TEXT NOT NULL DEFAULT 'INITIATED',
  smartflo_call_id TEXT,
  smartflo_ref_id TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  last_event TEXT,
  raw_last_event JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smartflo_dial_sessions_telecaller_started
  ON public.smartflo_dial_sessions (telecaller_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_smartflo_dial_sessions_customer_started
  ON public.smartflo_dial_sessions (customer_phone, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_smartflo_dial_sessions_open
  ON public.smartflo_dial_sessions (status, started_at DESC)
  WHERE status IN ('INITIATED', 'RINGING', 'ANSWERED');

CREATE UNIQUE INDEX IF NOT EXISTS idx_smartflo_dial_sessions_call_id
  ON public.smartflo_dial_sessions (smartflo_call_id)
  WHERE smartflo_call_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_smartflo_dial_sessions_ref_id
  ON public.smartflo_dial_sessions (smartflo_ref_id)
  WHERE smartflo_ref_id IS NOT NULL;

COMMENT ON TABLE public.smartflo_dial_sessions IS
  'Live click-to-call sessions; dialer polls status; Smartflo webhooks advance RINGING→ANSWERED→ENDED';
