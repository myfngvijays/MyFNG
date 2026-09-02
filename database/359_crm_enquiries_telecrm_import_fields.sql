-- Extra fields for TeleCRM CSV import into crm_enquiries.
ALTER TABLE public.crm_enquiries
  ADD COLUMN IF NOT EXISTS lead_tags text,
  ADD COLUMN IF NOT EXISTS package_rate_access text;

COMMENT ON COLUMN public.crm_enquiries.lead_tags IS
  'Matched CRM tags from TeleCRM LEADTAG (e.g. Incoming Sarv Call, Website, App Booking).';
COMMENT ON COLUMN public.crm_enquiries.package_rate_access IS
  'TeleCRM packagerateaccess (e.g. RO Mumbai).';

INSERT INTO public.crm_lead_tags (name, color)
SELECT 'Incoming Sarv Call', '#FECACA'
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_lead_tags t
  WHERE lower(btrim(t.name)) = 'incoming sarv call'
);
