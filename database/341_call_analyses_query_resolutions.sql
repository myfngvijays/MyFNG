-- Per-query resolution depth for Call Intelligence
ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS query_resolutions JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS overall_resolution TEXT;

ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS queries_total INTEGER;

ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS queries_resolved INTEGER;

ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS queries_partial INTEGER;

ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS queries_unresolved INTEGER;

ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS resolution_score INTEGER;

ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS unresolved_gaps TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.telecaller_call_analyses.query_resolutions IS
  'Array of {query, agent_answer, resolution, evidence, gap} — free or OpenAI deep';
COMMENT ON COLUMN public.telecaller_call_analyses.overall_resolution IS
  'FULLY_RESOLVED | PARTIALLY_RESOLVED | NOT_RESOLVED | NOT_APPLICABLE | UNKNOWN';
