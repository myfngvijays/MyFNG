-- Extra contact columns (car number, address, …) and which bot flow a template button starts.
-- Safe to re-run.

ALTER TABLE public.wa_bulk_contacts
  ADD COLUMN IF NOT EXISTS fields jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.wa_bulk_button_flows (
  template_name text NOT NULL,
  button_text text NOT NULL,
  bot_flow_id uuid NOT NULL REFERENCES public.bot_flows(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_name, button_text)
);

ALTER TABLE public.wa_bulk_button_flows ENABLE ROW LEVEL SECURITY;
