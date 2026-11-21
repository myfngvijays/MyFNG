-- CRM API Templates (TeleCRM-style outbound webhooks), managed from
-- Super Admin / Lead Manager → API Templates.
--
-- A template = endpoint + method + auth + payload with {{Variables}}.
-- It fires when a lead moves into its trigger status (e.g. SERVICE_DONE), from any panel / app.
-- Every send is logged in crm_api_template_runs.
--
-- Secrets (bearer token, password, header value) live here; the table is service-role only
-- (RLS on, no policies) and the API never returns them in full.
--
-- Run once in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.crm_api_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  method          text NOT NULL DEFAULT 'POST' CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  url             text NOT NULL,
  timeout_seconds integer NOT NULL DEFAULT 10 CHECK (timeout_seconds BETWEEN 1 AND 60),
  auth_type       text NOT NULL DEFAULT 'NONE' CHECK (auth_type IN ('NONE', 'BEARER', 'BASIC', 'HEADER')),
  auth_token      text,          -- BEARER token
  auth_username   text,          -- BASIC
  auth_password   text,          -- BASIC
  auth_header_name  text,        -- HEADER (e.g. x-api-key)
  auth_header_value text,        -- HEADER
  extra_headers   jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_type    text NOT NULL DEFAULT 'JSON' CHECK (payload_type IN ('JSON', 'FORM')),
  payload_template text NOT NULL DEFAULT '{}',
  -- CRM status that fires it: SERVICE_DONE, BOOKING_CONFIRMED, IN_SERVICE, LOST, ... or MANUAL (test only)
  trigger_status  text NOT NULL DEFAULT 'MANUAL',
  is_active       boolean NOT NULL DEFAULT true,
  last_run_at     timestamptz,
  last_run_ok     boolean,
  last_run_status integer,
  last_run_error  text,
  created_by_id   uuid,
  created_by_name text,
  updated_by_id   uuid,
  updated_by_name text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS crm_api_templates_trigger_idx
  ON public.crm_api_templates (trigger_status)
  WHERE deleted_at IS NULL AND is_active;

CREATE TABLE IF NOT EXISTS public.crm_api_template_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid REFERENCES public.crm_api_templates(id) ON DELETE CASCADE,
  lead_id       uuid,
  lead_number   text,
  trigger       text,            -- status that fired it, or TEST
  ok            boolean NOT NULL DEFAULT false,
  status_code   integer,
  error         text,
  request_body  text,
  response_body text,
  duration_ms   integer,
  run_by_id     uuid,
  run_by_name   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_api_template_runs_template_idx
  ON public.crm_api_template_runs (template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_api_template_runs_lead_idx
  ON public.crm_api_template_runs (lead_id, created_at DESC);

-- Service role only (server routes). No policies = no anon/authenticated access.
ALTER TABLE public.crm_api_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_api_template_runs ENABLE ROW LEVEL SECURITY;
