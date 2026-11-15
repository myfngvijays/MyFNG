-- Other lead status, same idea as Lost: the status itself, plus an empty list of items you can add.
-- Safe to re-run.

INSERT INTO public.crm_lead_statuses (
  code, name, color, sort_order, is_system, is_active,
  requires_follow_up, requires_lost_reason, call_status, outcome, pipeline_status, stage_group
)
SELECT
  'OTHER', 'Other', '#EDE9FE', 80, true, true,
  false, false, 'ANSWERED', 'INFO_COLLECTED', NULL, 'other'
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_lead_statuses s WHERE lower(btrim(s.code)) = 'other'
);

CREATE TABLE IF NOT EXISTS public.crm_other_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_other_reasons_name_lower_uidx
  ON public.crm_other_reasons (lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_crm_other_reasons_active_sort
  ON public.crm_other_reasons (is_active, sort_order, name);

COMMENT ON TABLE public.crm_other_reasons IS
  'Items shown when a lead status is set to Other. Starts empty.';
