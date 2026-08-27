-- =====================================================
-- CRM mix: tabular ML scores + Deep Learning voice insights
-- ML  = conversion score, ghost risk, best hour to call
-- DL  = Whisper transcript, emotion / intent, embeddings
-- =====================================================

CREATE TABLE IF NOT EXISTS public.telecaller_lead_scores (
  lead_id UUID PRIMARY KEY REFERENCES public.service_leads(id) ON DELETE CASCADE,
  conversion_score SMALLINT NOT NULL CHECK (conversion_score BETWEEN 0 AND 100),
  temperature TEXT NOT NULL DEFAULT 'warm',
  ghost_risk SMALLINT NOT NULL DEFAULT 0 CHECK (ghost_risk BETWEEN 0 AND 100),
  best_call_hour SMALLINT CHECK (best_call_hour BETWEEN 0 AND 23),
  best_call_label TEXT,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  engine TEXT NOT NULL DEFAULT 'tabular_ml_v1',
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_scores_score
  ON public.telecaller_lead_scores (conversion_score DESC);

CREATE INDEX IF NOT EXISTS idx_lead_scores_scored
  ON public.telecaller_lead_scores (scored_at DESC);

COMMENT ON TABLE public.telecaller_lead_scores IS
  'Tabular ML conversion score + best IST hour to call (no GPU).';

CREATE TABLE IF NOT EXISTS public.telecaller_call_dl (
  call_log_id UUID PRIMARY KEY REFERENCES public.telecaller_call_logs(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.service_leads(id) ON DELETE SET NULL,
  transcript TEXT,
  transcript_chars INT,
  emotion TEXT,
  emotion_score SMALLINT,
  voice_intent TEXT,
  voice_intent_score SMALLINT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  embedding JSONB,
  engine TEXT,
  warning TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_dl_lead
  ON public.telecaller_call_dl (lead_id);

CREATE INDEX IF NOT EXISTS idx_call_dl_processed
  ON public.telecaller_call_dl (processed_at DESC);

COMMENT ON TABLE public.telecaller_call_dl IS
  'Deep Learning voice layer: transcript (Whisper), emotion, intent, embedding.';

CREATE TABLE IF NOT EXISTS public.telecaller_lead_embeddings (
  lead_id UUID PRIMARY KEY REFERENCES public.service_leads(id) ON DELETE CASCADE,
  profile_text TEXT,
  embedding JSONB,
  outcome TEXT,
  engine TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  embedded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_embeddings_outcome
  ON public.telecaller_lead_embeddings (outcome);

COMMENT ON TABLE public.telecaller_lead_embeddings IS
  'Lead profile embeddings for similar booked-lead search.';
