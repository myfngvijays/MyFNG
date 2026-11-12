-- Custom fields created from a contact upload, plus auto-reply on campaign results.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.wa_bulk_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  field_type text NOT NULL DEFAULT 'STRING',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_bulk_recipients
  ADD COLUMN IF NOT EXISTS reply_kind text;

ALTER TABLE public.wa_bulk_custom_fields ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.wa_bulk_custom_fields IS 'Columns from bulk WhatsApp contact uploads (car number, address, and fields added by hand)';
