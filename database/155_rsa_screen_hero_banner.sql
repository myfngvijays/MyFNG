-- =====================================================
-- RSA Screen Hero Banner (public, admin-managed)
-- Purpose: Single hero image at top of mobile RSA screen (Android + iOS),
--          managed from Super Admin → Website Images → RSA Hero Banner.
-- Notes:
-- - App shows the first active row by display_order.
-- - Public read enabled (mobile uses anon key).
-- =====================================================

CREATE TABLE IF NOT EXISTS public.rsa_screen_hero_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  image_url text NOT NULL,
  route_name text NOT NULL DEFAULT 'RoadsideAssistance',
  route_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rsa_screen_hero_banners_active_order_idx
ON public.rsa_screen_hero_banners (is_active, display_order, created_at);

ALTER TABLE public.rsa_screen_hero_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read rsa screen hero banners" ON public.rsa_screen_hero_banners;
CREATE POLICY "Public can read rsa screen hero banners" ON public.rsa_screen_hero_banners
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Super admins can manage rsa screen hero banners" ON public.rsa_screen_hero_banners;
CREATE POLICY "Super admins can manage rsa screen hero banners" ON public.rsa_screen_hero_banners
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);
