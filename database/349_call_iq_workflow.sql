-- Call IQ automation (TeleCRM flowchart):
-- On recording completed → lead status filter → duration >= 90s → Call Audit SOP

ALTER TABLE public.ai_sales_playbook
  ADD COLUMN IF NOT EXISTS call_iq_workflow JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.ai_sales_playbook.call_iq_workflow IS
  '{ enabled, min_duration_sec, lead_statuses[], use_deep_ai, skip_if_sop_exists } — AI Workflow Call Audit';

ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS workflow_run_at TIMESTAMPTZ;

ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS workflow_trigger TEXT;

CREATE INDEX IF NOT EXISTS idx_call_analyses_workflow
  ON public.telecaller_call_analyses (workflow_run_at DESC NULLS LAST);
