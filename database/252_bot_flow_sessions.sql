-- Bot flow runtime sessions (Phase 2 executor)
CREATE TABLE IF NOT EXISTS public.bot_flow_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  flow_id UUID REFERENCES public.bot_flows(id) ON DELETE SET NULL,
  version_id UUID REFERENCES public.bot_flow_versions(id) ON DELETE SET NULL,
  current_node_id TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_inbound_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_flow_sessions_flow_id ON public.bot_flow_sessions(flow_id);
CREATE INDEX IF NOT EXISTS idx_bot_flow_sessions_status ON public.bot_flow_sessions(status);
CREATE INDEX IF NOT EXISTS idx_bot_flow_sessions_updated_at ON public.bot_flow_sessions(updated_at DESC);

ALTER TABLE public.bot_flow_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages bot_flow_sessions" ON public.bot_flow_sessions;
CREATE POLICY "Service role manages bot_flow_sessions" ON public.bot_flow_sessions
FOR ALL
USING (true)
WITH CHECK (true);
