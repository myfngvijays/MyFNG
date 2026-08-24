-- =====================================================
-- AI Suite: Sales Playbook + Call IQ SOP + Lead IQ
-- TeleCRM-style structured audit (prompt → fields)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_sales_playbook (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_key TEXT NOT NULL UNIQUE DEFAULT 'myfng',
  detail_depth TEXT NOT NULL DEFAULT 'standard',
  language TEXT NOT NULL DEFAULT 'English',
  voice_style TEXT,
  icp TEXT,
  product_features TEXT,
  pricing TEXT,
  objection_handling TEXT,
  competitors TEXT,
  call_iq_prompt TEXT,
  lead_iq_prompt TEXT,
  call_iq_enabled BOOLEAN NOT NULL DEFAULT true,
  lead_iq_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_sales_playbook IS
  'Workspace sales playbook grounding Call IQ / Lead IQ (Voice, ICP, USPs, pricing, objections, competitors).';

ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS sop_audit JSONB;

COMMENT ON COLUMN public.telecaller_call_analyses.sop_audit IS
  'MY FNG Sales SOP structured audit (qualification, USPs, objections, closing, soft skills, score).';

CREATE INDEX IF NOT EXISTS idx_call_analyses_sop_score
  ON public.telecaller_call_analyses (((sop_audit->>'overall_score')::int) DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.telecaller_lead_iq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  verdict TEXT,
  intent_level TEXT,
  buyer_type TEXT,
  decision_stage TEXT,
  hidden_risk TEXT,
  next_move TEXT,
  whatsapp_script TEXT,
  call_script TEXT,
  facts JSONB DEFAULT '[]'::jsonb,
  brief JSONB DEFAULT '{}'::jsonb,
  engine TEXT NOT NULL DEFAULT 'free_lead_iq_v1',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT telecaller_lead_iq_lead_unique UNIQUE (lead_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_iq_generated
  ON public.telecaller_lead_iq (generated_at DESC);

COMMENT ON TABLE public.telecaller_lead_iq IS
  'Lead IQ brief: intent, risk, next move, WhatsApp + call script from lead history + playbook.';
