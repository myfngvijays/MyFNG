-- Google Ads landing page SEO row for /car-service-and-repairs

BEGIN;

INSERT INTO public.site_page_seo (
  page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order
)
SELECT
  '/car-service-and-repairs',
  'Car Service and Repairs (Ads)',
  'Car Service and Repairs Near Me | MyFNG Mumbai Pune Thane',
  'Book car service and repairs near you at verified MYFNG workshops in Mumbai, Pune, Thane & Navi Mumbai. Periodic car servicing, AC repair, engine repair, free pickup, genuine parts and warranty.',
  'car service and repairs, car service near me, car repair near me, car servicing Mumbai, car repair Pune, car service Thane, mechanic near me, periodic car service, car AC repair, car garage near me, MYFNG',
  'car service and repairs',
  '/car-service-and-repairs',
  'Mumbai',
  FALSE,
  15
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-service-and-repairs');

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '357 applied: site_page_seo row for /car-service-and-repairs';
END $$;
