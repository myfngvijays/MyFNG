-- =====================================================
-- Free Call Intelligence analyses (heuristics, no paid AI)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.telecaller_call_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id UUID NOT NULL REFERENCES public.telecaller_call_logs(id) ON DELETE CASCADE,
  sentiment TEXT,
  sentiment_score NUMERIC(4,3),
  conversation_tags TEXT[] DEFAULT '{}',
  quality_score INTEGER,
  quality_grade TEXT,
  quality_flags TEXT[] DEFAULT '{}',
  speech_insights TEXT[] DEFAULT '{}',
  summary TEXT,
  buying_intent TEXT,
  customer_problem TEXT,
  customer_problem_categories TEXT[] DEFAULT '{}',
  agent_solution TEXT,
  solution_adequacy TEXT,
  solution_score INTEGER,
  coaching_tips TEXT[] DEFAULT '{}',
  engine TEXT NOT NULL DEFAULT 'free_heuristics_v1',
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT telecaller_call_analyses_call_log_unique UNIQUE (call_log_id)
);

CREATE INDEX IF NOT EXISTS idx_call_analyses_analyzed
  ON public.telecaller_call_analyses (analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_analyses_quality
  ON public.telecaller_call_analyses (quality_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_call_analyses_sentiment
  ON public.telecaller_call_analyses (sentiment);

COMMENT ON TABLE public.telecaller_call_analyses IS
  'Free heuristic call intelligence (quality, sentiment, tags) — no paid ASR/LLM';
