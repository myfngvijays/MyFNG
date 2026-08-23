-- Problem / solution fields for free Call Intelligence
ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS customer_problem TEXT;

ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS customer_problem_categories TEXT[] DEFAULT '{}';

ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS agent_solution TEXT;

ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS solution_adequacy TEXT;

ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS solution_score INTEGER;

ALTER TABLE public.telecaller_call_analyses
  ADD COLUMN IF NOT EXISTS coaching_tips TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_call_analyses_solution
  ON public.telecaller_call_analyses (solution_adequacy);

COMMENT ON COLUMN public.telecaller_call_analyses.customer_problem IS
  'Free heuristic: customer issue extracted from notes / lead problem_description';
COMMENT ON COLUMN public.telecaller_call_analyses.agent_solution IS
  'Free heuristic: what telecaller offered (slot, price, workshop, etc.)';
COMMENT ON COLUMN public.telecaller_call_analyses.solution_adequacy IS
  'PROPER | PARTIAL | MISSING | NOT_NEEDED | UNKNOWN';
