-- TeleCRM-style Call-IQ agents (name, versions, structured output fields).
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.call_iq_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'OpenAI',
  agent_type TEXT NOT NULL DEFAULT 'Call-IQ',
  current_version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.call_iq_agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.call_iq_agents(id) ON DELETE CASCADE,
  version INT NOT NULL,
  instruction TEXT NOT NULL DEFAULT '',
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, version)
);

CREATE INDEX IF NOT EXISTS idx_call_iq_agents_updated
  ON public.call_iq_agents (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_iq_agent_versions_agent
  ON public.call_iq_agent_versions (agent_id, version DESC);

COMMENT ON TABLE public.call_iq_agents IS
  'Call-IQ assistants (TeleCRM-style). Output fields live on versions.';
