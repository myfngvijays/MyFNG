-- Canonical city landing slugs: /car-service-in/thane → /car-service-in-thane
UPDATE public.site_page_seo
SET
  page_path = replace(page_path, '/car-service-in/', '/car-service-in-'),
  canonical_path = replace(coalesce(canonical_path, page_path), '/car-service-in/', '/car-service-in-')
WHERE page_path LIKE '/car-service-in/%';
