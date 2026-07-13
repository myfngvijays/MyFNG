-- Link post-booking membership purchase to the booking that must complete before claims unlock
ALTER TABLE public.customer_memberships
  ADD COLUMN IF NOT EXISTS source_lead_id UUID REFERENCES public.service_leads(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.customer_memberships.source_lead_id IS
  'When set (post-booking membership), benefit claims unlock after this service lead is completed';

CREATE INDEX IF NOT EXISTS idx_customer_memberships_source_lead
  ON public.customer_memberships(source_lead_id)
  WHERE source_lead_id IS NOT NULL;
