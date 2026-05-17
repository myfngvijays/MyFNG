-- =====================================================
-- Home Promo Banners (admin-managed, public read)
-- Purpose: 4 promotional cards rendered on the mobile PublicHome screen
--          and PublicServicePackages screen (e.g., Loan, E-Challan, Fuel,
--          Sell Car). Lets the admin upload / replace / re-order them
--          without redeploying the app. Mirrors home_carousel_banners.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.home_promo_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  image_url text NOT NULL,
  route_name text NOT NULL DEFAULT 'PublicHome',
  route_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS home_promo_banners_active_order_idx
ON public.home_promo_banners (is_active, display_order, created_at);

ALTER TABLE public.home_promo_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read home promo banners" ON public.home_promo_banners;
CREATE POLICY "Public can read home promo banners" ON public.home_promo_banners
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Super admins can manage home promo banners" ON public.home_promo_banners;
CREATE POLICY "Super admins can manage home promo banners" ON public.home_promo_banners
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);
