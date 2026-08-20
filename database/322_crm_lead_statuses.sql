-- CRM lead statuses (manager / admin create & edit, like TeleCRM dispositions).
-- Seeds current default statuses; safe to re-run.

CREATE TABLE IF NOT EXISTS public.crm_lead_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#BFDBFE',
  sort_order int NOT NULL DEFAULT 100,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  requires_follow_up boolean NOT NULL DEFAULT false,
  requires_lost_reason boolean NOT NULL DEFAULT false,
  call_status text NOT NULL DEFAULT 'ANSWERED',
  outcome text,
  pipeline_status text,
  created_by uuid REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_lead_statuses_code_lower_uidx
  ON public.crm_lead_statuses (lower(btrim(code)));

CREATE UNIQUE INDEX IF NOT EXISTS crm_lead_statuses_name_lower_uidx
  ON public.crm_lead_statuses (lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_crm_lead_statuses_active_sort
  ON public.crm_lead_statuses (is_active, sort_order, name);

COMMENT ON TABLE public.crm_lead_statuses IS
  'CRM disposition / lead status options for telecaller picker + filters (Lead Manager / Admin)';

INSERT INTO public.crm_lead_statuses (
  code, name, color, sort_order, is_system, is_active,
  requires_follow_up, requires_lost_reason, call_status, outcome, pipeline_status
)
SELECT v.code, v.name, v.color, v.sort_order, v.is_system, v.is_active,
       v.requires_follow_up, v.requires_lost_reason, v.call_status, v.outcome, v.pipeline_status
FROM (
  VALUES
    ('FRESH', 'Fresh', '#DBEAFE', 5, true, true, false, false, 'ANSWERED', 'INFO_COLLECTED', NULL::text),
    ('INTERESTED', 'Interested', '#FFEDD5', 10, true, true, false, false, 'ANSWERED', 'INFO_COLLECTED', NULL),
    ('WILL_VISIT', 'He will visit', '#EDE9FE', 20, true, true, false, false, 'ANSWERED', 'INFO_COLLECTED', NULL),
    ('CALLBACK', 'Follow-up', '#E0F2FE', 30, true, true, true, false, 'ANSWERED', 'INFO_COLLECTED', NULL),
    ('BOOKING_CONFIRMED', 'Booking confirmed', '#D1FAE5', 40, true, true, false, false, 'ANSWERED', 'LEAD_CREATED', 'VALIDATED'),
    ('IN_SERVICE', 'In Service', '#DBEAFE', 50, true, true, false, false, 'ANSWERED', 'INFO_COLLECTED', 'IN_PROGRESS'),
    ('SERVICE_DONE', 'Service Done', '#A7F3D0', 60, true, true, false, false, 'ANSWERED', 'INFO_COLLECTED', 'COMPLETED'),
    ('LOST', 'Lost', '#FEE2E2', 70, true, true, false, true, 'ANSWERED', 'NOT_INTERESTED', 'REJECTED'),
    ('RINGING', 'Ringing / No answer', '#F1F5F9', 80, true, true, false, false, 'NO_ANSWER', NULL, NULL)
) AS v(code, name, color, sort_order, is_system, is_active, requires_follow_up, requires_lost_reason, call_status, outcome, pipeline_status)
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_lead_statuses s WHERE lower(btrim(s.code)) = lower(btrim(v.code))
);
