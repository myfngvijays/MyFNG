-- Extra WhatsApp numbers for bulk campaigns.
-- The number already saved in WhatsApp Settings stays available without a row here.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.wa_bulk_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT '',
  display_phone text NOT NULL DEFAULT '',
  verified_name text NOT NULL DEFAULT '',
  phone_number_id text NOT NULL UNIQUE,
  waba_id text NOT NULL DEFAULT '',
  access_token text NOT NULL,
  api_url text NOT NULL DEFAULT 'https://graph.facebook.com/v25.0',
  quality_rating text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_bulk_accounts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.wa_bulk_accounts IS 'WhatsApp numbers a super admin connects for bulk campaigns. One row can be active.';
