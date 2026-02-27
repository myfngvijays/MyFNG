-- Add missing lead_source column used by public booking create flow.
-- Safe to run multiple times.

ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS lead_source character varying(50) NULL DEFAULT 'WEB';

COMMENT ON COLUMN public.service_leads.lead_source IS
'Origin/source of lead creation (e.g., WEB, APP, WHATSAPP, MANUAL).';
