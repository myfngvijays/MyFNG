-- =====================================================
-- Smartflo CDR / call recordings → MyFNG CRM
-- =====================================================

-- Extra columns on existing call logs (safe if already present)
ALTER TABLE public.telecaller_call_logs
  ADD COLUMN IF NOT EXISTS smartflo_call_id TEXT;

ALTER TABLE public.telecaller_call_logs
  ADD COLUMN IF NOT EXISTS smartflo_recording_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_telecaller_call_logs_smartflo_call_id
  ON public.telecaller_call_logs (smartflo_call_id)
  WHERE smartflo_call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_telecaller_call_logs_phone_created
  ON public.telecaller_call_logs (phone_number, created_at DESC);

-- Raw CDR rows from Smartflo (webhook + poll)
CREATE TABLE IF NOT EXISTS public.smartflo_call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smartflo_call_id TEXT NOT NULL,
  client_number TEXT,
  agent_number TEXT,
  did_number TEXT,
  direction TEXT,
  status TEXT,
  call_duration INTEGER,
  answered_seconds INTEGER,
  recording_url TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  raw JSONB,
  lead_id UUID REFERENCES public.service_leads(id) ON DELETE SET NULL,
  call_log_id UUID REFERENCES public.telecaller_call_logs(id) ON DELETE SET NULL,
  matched_at TIMESTAMPTZ,
  source TEXT DEFAULT 'cdr', -- cdr | webhook
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT smartflo_call_recordings_call_id_unique UNIQUE (smartflo_call_id)
);

CREATE INDEX IF NOT EXISTS idx_smartflo_recordings_client
  ON public.smartflo_call_recordings (client_number);

CREATE INDEX IF NOT EXISTS idx_smartflo_recordings_lead
  ON public.smartflo_call_recordings (lead_id);

CREATE INDEX IF NOT EXISTS idx_smartflo_recordings_started
  ON public.smartflo_call_recordings (started_at DESC NULLS LAST);

COMMENT ON TABLE public.smartflo_call_recordings IS
  'Smartflo CDR rows; recording_url matched onto telecaller_call_logs / service_leads';
