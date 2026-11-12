-- Adds upload batches, button → TeleCRM mapping, and reply tracking.
-- Safe if 388 was already applied. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.wa_bulk_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  added int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_bulk_contacts
  ADD COLUMN IF NOT EXISTS upload_id uuid REFERENCES public.wa_bulk_uploads(id) ON DELETE SET NULL;

ALTER TABLE public.wa_bulk_campaigns
  ADD COLUMN IF NOT EXISTS button_map jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.wa_bulk_recipients
  ADD COLUMN IF NOT EXISTS reply_button text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wa_bulk_contacts_created
  ON public.wa_bulk_contacts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_bulk_contacts_upload
  ON public.wa_bulk_contacts (upload_id);

ALTER TABLE public.wa_bulk_uploads ENABLE ROW LEVEL SECURITY;
