-- Stage buckets (active/won/lost) + Fresh status + lost reasons CRUD.
-- Safe to re-run. Requires crm_lead_statuses (322) or creates it lightly.

ALTER TABLE public.crm_lead_statuses
  ADD COLUMN IF NOT EXISTS stage_group text NOT NULL DEFAULT 'active';

COMMENT ON COLUMN public.crm_lead_statuses.stage_group IS
  'TeleCRM-style bucket: active | won | lost';

UPDATE public.crm_lead_statuses
SET stage_group = 'won'
WHERE upper(btrim(code)) IN ('SERVICE_DONE', 'WON')
  AND stage_group IS DISTINCT FROM 'won';

UPDATE public.crm_lead_statuses
SET stage_group = 'lost'
WHERE upper(btrim(code)) IN ('LOST')
  AND stage_group IS DISTINCT FROM 'lost';

UPDATE public.crm_lead_statuses
SET stage_group = 'active'
WHERE stage_group IS NULL
   OR stage_group NOT IN ('active', 'won', 'lost');

-- Fresh (was "New" in filters) — selectable lead status
INSERT INTO public.crm_lead_statuses (
  code, name, color, sort_order, is_system, is_active,
  requires_follow_up, requires_lost_reason, call_status, outcome, pipeline_status, stage_group
)
SELECT
  'FRESH', 'Fresh', '#DBEAFE', 5, true, true,
  false, false, 'ANSWERED', 'INFO_COLLECTED', NULL, 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_lead_statuses s WHERE lower(btrim(s.code)) = 'fresh'
);

CREATE TABLE IF NOT EXISTS public.crm_lost_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_lost_reasons_name_lower_uidx
  ON public.crm_lost_reasons (lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_crm_lost_reasons_active_sort
  ON public.crm_lost_reasons (is_active, sort_order, name);

COMMENT ON TABLE public.crm_lost_reasons IS
  'Lost-reason options for Lost disposition (Lead Manager / Admin)';

INSERT INTO public.crm_lost_reasons (name, sort_order, is_active)
SELECT v.name, v.sort_order, true
FROM (
  VALUES
    ('Not Interested', 10),
    ('Unqualified Lead', 20),
    ('No-Response to Calls', 30),
    ('Already Service Done', 40),
    ('Under Warranty', 50),
    ('Looking For Authorised Service Center', 60),
    ('Other Reasons', 70)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_lost_reasons r WHERE lower(btrim(r.name)) = lower(btrim(v.name))
);
