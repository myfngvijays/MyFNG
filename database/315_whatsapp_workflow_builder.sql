-- WhatsApp Workflow Builder (TeleCRM-style) — extends existing bot_flows
-- Syncs with admin Bot Flow / Templates / inbound WhatsApp runtime.

ALTER TABLE public.bot_flows
  ADD COLUMN IF NOT EXISTS trigger_event VARCHAR(80) NOT NULL DEFAULT 'whatsapp_incoming',
  ADD COLUMN IF NOT EXISTS description TEXT NULL,
  ADD COLUMN IF NOT EXISTS total_runs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success_runs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_runs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS idx_bot_flows_trigger_event ON public.bot_flows(trigger_event);

CREATE TABLE IF NOT EXISTS public.bot_flow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_flow_id UUID NOT NULL REFERENCES public.bot_flows(id) ON DELETE CASCADE,
  version_id UUID NULL REFERENCES public.bot_flow_versions(id) ON DELETE SET NULL,
  trigger_event VARCHAR(80) NOT NULL DEFAULT 'whatsapp_incoming',
  phone VARCHAR(32) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'RUNNING', -- RUNNING | SUCCESS | FAILED | SKIPPED
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  trace JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_flow_runs_flow_id ON public.bot_flow_runs(bot_flow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_flow_runs_status ON public.bot_flow_runs(status);
CREATE INDEX IF NOT EXISTS idx_bot_flow_runs_phone ON public.bot_flow_runs(phone);

ALTER TABLE public.bot_flow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage bot_flow_runs" ON public.bot_flow_runs;
CREATE POLICY "Admins can manage bot_flow_runs" ON public.bot_flow_runs
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE (ul.id = auth.uid() OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR ul.phone = (auth.jwt() ->> 'phone'))
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE (ul.id = auth.uid() OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR ul.phone = (auth.jwt() ->> 'phone'))
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

COMMENT ON TABLE public.bot_flow_runs IS 'Execution log for WhatsApp workflow / bot builder runs';
COMMENT ON COLUMN public.bot_flows.trigger_event IS 'TeleCRM-style start event key, e.g. whatsapp_incoming, template_replied, lead_assigned';
