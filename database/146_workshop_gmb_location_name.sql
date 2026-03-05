-- Persist selected Google Business Profile location resource name
-- so the same location is remembered for each public page.

ALTER TABLE public.workshop_public_pages
  ADD COLUMN IF NOT EXISTS gmb_location_name TEXT;

COMMENT ON COLUMN public.workshop_public_pages.gmb_location_name IS
  'Google Business location resource name, e.g. accounts/123/locations/456';

