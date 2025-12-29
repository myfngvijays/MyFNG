-- =====================================================
-- Home Carousel Banners (public, admin-managed)
-- Purpose: Mobile PublicHome hero carousel should render images uploaded from web admin,
--          and navigate to an admin-configured route with optional params.
-- Notes:
-- - Public read enabled (mobile uses anon key).
-- - Super Admin can manage.
-- - `route_params` supports placeholders like "__CITY__" (resolved client-side).
-- =====================================================

CREATE TABLE IF NOT EXISTS public.home_carousel_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  image_url text NOT NULL,
  route_name text NOT NULL,
  route_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS home_carousel_banners_active_order_idx
ON public.home_carousel_banners (is_active, display_order, created_at);

ALTER TABLE public.home_carousel_banners ENABLE ROW LEVEL SECURITY;

-- Public read (mobile home)
DROP POLICY IF EXISTS "Public can read home carousel banners" ON public.home_carousel_banners;
CREATE POLICY "Public can read home carousel banners" ON public.home_carousel_banners
FOR SELECT
USING (true);

-- Admin manage
DROP POLICY IF EXISTS "Super admins can manage home carousel banners" ON public.home_carousel_banners;
CREATE POLICY "Super admins can manage home carousel banners" ON public.home_carousel_banners
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);


