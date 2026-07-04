-- Add map embed URL field for Google Maps iframe embed
ALTER TABLE public.workshop_public_pages
  ADD COLUMN IF NOT EXISTS map_embed_url TEXT;

COMMENT ON COLUMN public.workshop_public_pages.map_embed_url IS 'Google Maps iframe embed URL for map preview on the public page';
