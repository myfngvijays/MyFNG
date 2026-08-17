-- Telecaller CRM permission templates (TeleCRM-style access control)
-- Lead Manager assigns a template to each telecaller.

CREATE TABLE IF NOT EXISTS public.telecaller_permission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_telecaller_permission_templates_name
  ON public.telecaller_permission_templates (lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS uq_telecaller_permission_templates_one_default
  ON public.telecaller_permission_templates ((is_default))
  WHERE is_default = true;

ALTER TABLE public.users_login
  ADD COLUMN IF NOT EXISTS crm_permission_template_id UUID
    REFERENCES public.telecaller_permission_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_login_crm_permission_template
  ON public.users_login(crm_permission_template_id);

COMMENT ON TABLE public.telecaller_permission_templates IS
  'CRM access templates for telecallers (reports, export, team leaderboard, etc.)';
COMMENT ON COLUMN public.users_login.crm_permission_template_id IS
  'Assigned CRM permission template; NULL = use default caller template';

-- Default Caller: own reports only, no CSV export, no team board, no engage nav
INSERT INTO public.telecaller_permission_templates (name, description, permissions, is_default)
SELECT
  'Default Caller',
  'Own leaderboard + call activity + duplicates. No CSV export. No team ranking.',
  '{
    "reports": true,
    "reports_export": false,
    "reports_team_leaderboard": false,
    "reports_duplicates": true,
    "engage": false
  }'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.telecaller_permission_templates WHERE lower(name) = lower('Default Caller')
);

INSERT INTO public.telecaller_permission_templates (name, description, permissions, is_default)
SELECT
  'Full Access Caller',
  'Team leaderboard + export + duplicates (still assigned-leads scope on APIs).',
  '{
    "reports": true,
    "reports_export": true,
    "reports_team_leaderboard": true,
    "reports_duplicates": true,
    "engage": false
  }'::jsonb,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.telecaller_permission_templates WHERE lower(name) = lower('Full Access Caller')
);

ALTER TABLE public.telecaller_permission_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS telecaller_permission_templates_select ON public.telecaller_permission_templates;
CREATE POLICY telecaller_permission_templates_select
  ON public.telecaller_permission_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true);

GRANT SELECT ON public.telecaller_permission_templates TO authenticated;
GRANT ALL ON public.telecaller_permission_templates TO service_role;
