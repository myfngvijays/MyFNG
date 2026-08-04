-- Add utm_term and utm_content to managed short links

ALTER TABLE public.managed_short_links
  ADD COLUMN IF NOT EXISTS utm_term VARCHAR(100),
  ADD COLUMN IF NOT EXISTS utm_content VARCHAR(100);

COMMENT ON COLUMN public.managed_short_links.utm_term IS 'UTM term appended on redirect';
COMMENT ON COLUMN public.managed_short_links.utm_content IS 'UTM content appended on redirect';
