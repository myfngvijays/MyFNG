-- Ganesh Prime card on Services (and Home promo strip). Same table as Promo Banners admin.

INSERT INTO public.home_promo_banners (
  title,
  image_url,
  route_name,
  route_params,
  display_order,
  is_active
)
SELECT
  'Ganesh Chaturthi Prime',
  'https://myfng.in/media/banners/myfng-prime-ganesh-chaturthi-promo.png',
  'Settings__Membership',
  '{"membershipType":"SERVICE"}'::jsonb,
  0,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.home_promo_banners
  WHERE title ILIKE '%ganesh%'
     OR image_url ILIKE '%ganesh%'
);
