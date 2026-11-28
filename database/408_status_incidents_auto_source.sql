-- Automatic /status incidents from live health probes (see lib/status/autoIncidentSync.ts).

ALTER TABLE public.status_incidents
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.status_incidents
  DROP CONSTRAINT IF EXISTS status_incidents_source_check;

ALTER TABLE public.status_incidents
  ADD CONSTRAINT status_incidents_source_check CHECK (source IN ('manual', 'auto'));

CREATE INDEX IF NOT EXISTS status_incidents_auto_open_idx
  ON public.status_incidents (source, state)
  WHERE source = 'auto' AND state <> 'resolved';