-- =====================================================
-- Customer Reviews: per-screen placement (home | rsa)
-- =====================================================

ALTER TABLE public.customer_reviews
  ADD COLUMN IF NOT EXISTS screen text NOT NULL DEFAULT 'home';

COMMENT ON COLUMN public.customer_reviews.screen IS 'App screen: home | rsa';

CREATE INDEX IF NOT EXISTS customer_reviews_screen_active_order_idx
  ON public.customer_reviews (screen, is_active, display_order, created_at);
