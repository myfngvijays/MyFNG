-- =====================================================
-- Customer Reviews (public, admin-managed)
-- Purpose: Reviews displayed in mobile app home screen carousel.
-- Notes:
-- - Public read enabled (mobile uses anon key).
-- - Super Admin can manage via admin panel.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.customer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  car text NOT NULL,
  stars integer NOT NULL DEFAULT 5 CHECK (stars >= 1 AND stars <= 5),
  text text NOT NULL,
  date text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_reviews_active_order_idx
ON public.customer_reviews (is_active, display_order, created_at);

ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;

-- Public read (mobile home)
DROP POLICY IF EXISTS "Public can read customer reviews" ON public.customer_reviews;
CREATE POLICY "Public can read customer reviews" ON public.customer_reviews
FOR SELECT
USING (true);

-- Admin manage
DROP POLICY IF EXISTS "Super admins can manage customer reviews" ON public.customer_reviews;
CREATE POLICY "Super admins can manage customer reviews" ON public.customer_reviews
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);
