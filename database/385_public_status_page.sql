-- Customer-facing status page (/status).
-- Rows are written only through the service role (super admin API).
-- No anon/authenticated policies: the public page reads via /api/status.

CREATE TABLE IF NOT EXISTS public.status_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  impact text NOT NULL,
  component_keys text[] NOT NULL DEFAULT '{}',
  state text NOT NULL DEFAULT 'investigating',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT status_incidents_title_len CHECK (char_length(title) BETWEEN 3 AND 160),
  CONSTRAINT status_incidents_impact_check CHECK (impact IN ('degraded', 'partial_outage', 'major_outage', 'maintenance')),
  CONSTRAINT status_incidents_state_check CHECK (state IN ('investigating', 'identified', 'monitoring', 'resolved'))
);

CREATE TABLE IF NOT EXISTS public.status_incident_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.status_incidents(id) ON DELETE CASCADE,
  state text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT status_incident_updates_body_len CHECK (char_length(body) BETWEEN 1 AND 2000),
  CONSTRAINT status_incident_updates_state_check CHECK (state IN ('investigating', 'identified', 'monitoring', 'resolved', 'update'))
);

CREATE TABLE IF NOT EXISTS public.status_maintenances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  component_keys text[] NOT NULL DEFAULT '{}',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT status_maintenances_title_len CHECK (char_length(title) BETWEEN 3 AND 160),
  CONSTRAINT status_maintenances_body_len CHECK (char_length(body) BETWEEN 1 AND 2000),
  CONSTRAINT status_maintenances_window CHECK (ends_at > starts_at),
  CONSTRAINT status_maintenances_state_check CHECK (state IN ('scheduled', 'in_progress', 'completed'))
);

CREATE INDEX IF NOT EXISTS status_incidents_open_idx
  ON public.status_incidents (state, created_at DESC);

CREATE INDEX IF NOT EXISTS status_incident_updates_incident_idx
  ON public.status_incident_updates (incident_id, created_at DESC);

CREATE INDEX IF NOT EXISTS status_maintenances_window_idx
  ON public.status_maintenances (state, starts_at DESC);

ALTER TABLE public.status_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_maintenances ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.status_incidents FROM anon, authenticated;
REVOKE ALL ON TABLE public.status_incident_updates FROM anon, authenticated;
REVOKE ALL ON TABLE public.status_maintenances FROM anon, authenticated;
