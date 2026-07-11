-- Relax gallery_images minimum constraint from >= 2 to >= 0
-- Allows bulk creation of public pages without requiring gallery images upfront
ALTER TABLE public.workshop_public_pages
  DROP CONSTRAINT IF EXISTS workshop_public_pages_gallery_min;

ALTER TABLE public.workshop_public_pages
  ADD CONSTRAINT workshop_public_pages_gallery_min CHECK (jsonb_array_length(gallery_images) >= 0);
