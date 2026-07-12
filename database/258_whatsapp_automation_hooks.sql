-- Backend hooks for WhatsApp automation (booking drafts + cron support)

BEGIN;

CREATE TABLE IF NOT EXISTS public.booking_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_key VARCHAR(64) NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_phone VARCHAR(20),
  customer_name VARCHAR(200),
  car_label VARCHAR(300),
  service_label VARCHAR(300),
  draft_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  step INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reminder_sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_drafts_status_check CHECK (status IN ('ACTIVE', 'COMPLETED', 'ABANDONED_NOTIFIED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_drafts_customer_draft_key
  ON public.booking_drafts(customer_id, draft_key);

CREATE INDEX IF NOT EXISTS idx_booking_drafts_active_reminder
  ON public.booking_drafts(status, last_activity_at)
  WHERE status = 'ACTIVE';

COMMIT;
