-- Replace the Ganesh Chaturthi home carousel slide with Navratri Prime.
-- Safe to re-run.

UPDATE public.home_carousel_banners
SET
  title = 'Navratri Prime',
  image_url = 'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/Mobile%20Screen%20-%20Hero%20Section/myfng-prime-navratri-banner-aligned.jpg',
  route_name = 'Settings__Membership',
  route_params = '{"membershipType":"SERVICE"}'::jsonb,
  is_active = true,
  updated_at = now()
WHERE title ILIKE '%ganesh%'
   OR image_url ILIKE '%ganesh%'
   OR image_url ILIKE '%myfng-prime-navratri-banner.jpg';

INSERT INTO public.home_carousel_banners (
  title,
  image_url,
  route_name,
  route_params,
  display_order,
  is_active
)
SELECT
  'Navratri Prime',
  'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/Mobile%20Screen%20-%20Hero%20Section/myfng-prime-navratri-banner-aligned.jpg',
  'Settings__Membership',
  '{"membershipType":"SERVICE"}'::jsonb,
  0,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.home_carousel_banners
  WHERE title ILIKE '%navratri%'
     OR image_url ILIKE '%navratri%'
);
