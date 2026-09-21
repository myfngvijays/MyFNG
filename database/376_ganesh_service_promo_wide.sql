-- Services / promo strip uses a wide 1029x376 card. Point Ganesh Prime at the
-- matching wide artwork so the 16:9 home-carousel file is not cropped.

UPDATE public.home_promo_banners
SET image_url = 'https://myfng.in/media/banners/myfng-prime-ganesh-chaturthi-promo.png'
WHERE title ILIKE '%ganesh%'
   OR image_url ILIKE '%ganesh-chaturthi-banner%';
