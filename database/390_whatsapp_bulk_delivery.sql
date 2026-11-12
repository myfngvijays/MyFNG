-- Delivery status on bulk recipients, so campaign reports can show delivered / read.
-- Safe to re-run.

ALTER TABLE public.wa_bulk_recipients
  ADD COLUMN IF NOT EXISTS delivery_status text;
