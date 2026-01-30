-- ================================================================
-- WORKSHOP PUBLIC PAGE EXTENSIONS (FAQS, PACKAGES, BRANDS)
-- Stored in workshop_public_pages for super admin editing UI
-- ================================================================

ALTER TABLE public.workshop_public_pages
  ADD COLUMN IF NOT EXISTS brands JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS packages JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.workshop_public_pages.brands IS 'Array of brands with name and logo_url';
COMMENT ON COLUMN public.workshop_public_pages.packages IS 'Array of package objects with name, price, features';
COMMENT ON COLUMN public.workshop_public_pages.faqs IS 'Array of FAQ objects with question and answer';
