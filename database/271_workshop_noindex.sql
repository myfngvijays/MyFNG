-- Phase 3: allow workshop public pages to be excluded from search index
ALTER TABLE public.workshop_public_pages
  ADD COLUMN IF NOT EXISTS noindex BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.workshop_public_pages.noindex IS 'When true, workshop page gets noindex robots and is excluded from sitemap.xml';

CREATE INDEX IF NOT EXISTS idx_workshop_public_pages_noindex
  ON public.workshop_public_pages (noindex)
  WHERE is_published = true AND noindex = false;
