-- Add Google My Business (GMB) data support for workshop public pages
-- public_gmb_url on workshops: stores the Google Maps URL per workshop
-- gmb_place_id, gmb_data, gmb_last_fetched_at on workshop_public_pages: stores fetched GMB data

ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS public_gmb_url TEXT;

ALTER TABLE public.workshop_public_pages
  ADD COLUMN IF NOT EXISTS gmb_place_id TEXT,
  ADD COLUMN IF NOT EXISTS gmb_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS gmb_last_fetched_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.workshops.public_gmb_url IS 'Google Maps URL for this workshop (used for GMB data fetch)';
COMMENT ON COLUMN public.workshop_public_pages.gmb_place_id IS 'Google Place ID for automatic re-fetching';
COMMENT ON COLUMN public.workshop_public_pages.gmb_data IS 'Cached GMB data: business_name, formatted_address, rating, total_reviews, reviews[], opening_hours[], phone_number, website, photos[]';
COMMENT ON COLUMN public.workshop_public_pages.gmb_last_fetched_at IS 'Timestamp of last successful GMB data fetch';
