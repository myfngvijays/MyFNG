-- Bulk WhatsApp: contacts, segments, and campaign sends.
-- Written only through the service role (super admin API).
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.wa_bulk_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  added int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_bulk_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  name text,
  upload_id uuid REFERENCES public.wa_bulk_uploads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wa_bulk_contacts_phone_unique UNIQUE (phone)
);

CREATE TABLE IF NOT EXISTS public.wa_bulk_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_bulk_segment_contacts (
  segment_id uuid NOT NULL REFERENCES public.wa_bulk_segments(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.wa_bulk_contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (segment_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_bulk_segment_contacts_contact
  ON public.wa_bulk_segment_contacts (contact_id);

CREATE TABLE IF NOT EXISTS public.wa_bulk_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  segment_id uuid REFERENCES public.wa_bulk_segments(id) ON DELETE SET NULL,
  template_name text NOT NULL,
  language_code text NOT NULL DEFAULT 'en',
  body_params jsonb NOT NULL DEFAULT '[]'::jsonb,
  button_map jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'sending',
  total int NOT NULL DEFAULT 0,
  sent int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.wa_bulk_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.wa_bulk_campaigns(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  message_id text,
  sent_at timestamptz,
  reply_button text,
  replied_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_wa_bulk_recipients_campaign_status
  ON public.wa_bulk_recipients (campaign_id, status);

-- First run created these tables before the extra columns existed.
-- CREATE TABLE IF NOT EXISTS does not add columns, so add them here.
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
ALTER TABLE public.wa_bulk_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_bulk_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_bulk_segment_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_bulk_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_bulk_recipients ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.wa_bulk_contacts IS 'Phone book for admin bulk WhatsApp (number +91 95949 96161)';
COMMENT ON TABLE public.wa_bulk_segments IS 'Contact groups for bulk WhatsApp';
COMMENT ON TABLE public.wa_bulk_campaigns IS 'One bulk template send to a segment';
