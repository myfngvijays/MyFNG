-- Services top strip is admin-managed only. Hide auto-inserted Ganesh promo
-- so loan / e-challan / fuel / sell (or new uploads) show instead.

UPDATE public.home_promo_banners
SET is_active = false
WHERE title ILIKE '%ganesh%'
   OR image_url ILIKE '%ganesh%';
