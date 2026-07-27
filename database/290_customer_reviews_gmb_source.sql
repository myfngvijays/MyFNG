-- 290_customer_reviews_gmb_source.sql
-- Track GMB-imported reviews for dedupe + auto sync (4★ / 5★).

ALTER TABLE public.customer_reviews
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source_location text;

COMMENT ON COLUMN public.customer_reviews.source IS 'manual | gmb | csv';
COMMENT ON COLUMN public.customer_reviews.external_id IS 'Stable Google review id / resource name for dedupe';
COMMENT ON COLUMN public.customer_reviews.source_location IS 'GBP location resource name used for sync';

CREATE UNIQUE INDEX IF NOT EXISTS customer_reviews_screen_external_id_uidx
  ON public.customer_reviews (screen, external_id)
  WHERE external_id IS NOT NULL AND external_id <> '';

CREATE INDEX IF NOT EXISTS customer_reviews_source_idx
  ON public.customer_reviews (source, is_active);
