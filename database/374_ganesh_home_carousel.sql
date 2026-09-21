-- Festive / light-theme home carousel (admin-managed).
-- App PublicHome reads this table; hardcoded fallback is only if the table is empty.

INSERT INTO public.home_carousel_banners (
  title,
  image_url,
  route_name,
  route_params,
  display_order,
  is_active
)
SELECT
  'Ganesh Chaturthi Prime',
  'https://myfng.in/media/banners/myfng-prime-ganesh-chaturthi-banner.png',
  'Settings__Membership',
  '{"membershipType":"SERVICE"}'::jsonb,
  0,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.home_carousel_banners
  WHERE title ILIKE '%ganesh%'
     OR image_url ILIKE '%ganesh%'
);

UPDATE public.home_carousel_banners
SET
  title = 'Car Service',
  image_url = 'https://myfng.in/media/banners/myfng-car-service-light-banner.png',
  is_active = true,
  updated_at = now()
WHERE id = (
  SELECT id
  FROM public.home_carousel_banners
  WHERE route_name IN ('PublicBookServiceNow', 'PublicServicePackages')
     OR (title ILIKE '%service%' AND title NOT ILIKE '%rsa%' AND title NOT ILIKE '%prime%')
  ORDER BY display_order ASC
  LIMIT 1
);

UPDATE public.home_carousel_banners
SET
  title = 'MyFNG AI',
  image_url = 'https://myfng.in/media/banners/myfng-misa-ai-light-banner.png',
  is_active = true,
  updated_at = now()
WHERE id = (
  SELECT id
  FROM public.home_carousel_banners
  WHERE route_name = 'AIBooking'
     OR title ILIKE '%misa%'
     OR title ILIKE '%ai%'
  ORDER BY display_order ASC
  LIMIT 1
);

UPDATE public.home_carousel_banners
SET is_active = false, updated_at = now()
WHERE is_active = true
  AND coalesce(image_url, '') NOT ILIKE '%ganesh%'
  AND coalesce(image_url, '') NOT ILIKE '%car-service-light-banner%'
  AND coalesce(image_url, '') NOT ILIKE '%misa-ai-light-banner%'
  AND coalesce(title, '') NOT ILIKE '%ganesh%';
