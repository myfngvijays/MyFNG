-- Phase 2: seed car service detail pages into site_page_seo (admin-managed SEO)
-- Safe to re-run: only inserts missing paths

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-services/periodic-car-service', 'Periodic Car Service', 'Periodic Car Service | MyFNG', 'Keep your car running smooth, safe, and fuel-efficient with MyFNG Periodic Car Service.', 'periodic car service, periodic car service near me, car service mumbai, car service pune, myfng', 'Periodic Car Service near me', '/car-services/periodic-car-service', 'Mumbai', FALSE, 101
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-services/periodic-car-service');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-services/car-engine-service', 'Car Engine Service', 'Car Engine Service | MyFNG', 'Expert car engine service at MYFNG verified workshops with transparent pricing and genuine parts.', 'car engine service, car engine service near me, car service mumbai, car service pune, myfng', 'Car Engine Service near me', '/car-services/car-engine-service', 'Mumbai', FALSE, 102
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-services/car-engine-service');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-services/car-ac-service', 'Car AC Service', 'Car AC Service | MyFNG', 'Restore cooling performance with MYFNG car AC service, gas refill, leak detection and inspection.', 'car ac service, car ac service near me, car service mumbai, car service pune, myfng', 'Car AC Service near me', '/car-services/car-ac-service', 'Mumbai', FALSE, 103
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-services/car-ac-service');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-services/car-battery-service', 'Car Battery Service', 'Car Battery Service | MyFNG', 'Car battery check, replacement and electrical diagnostics at verified MYFNG workshops.', 'car battery service, car battery service near me, car service mumbai, car service pune, myfng', 'Car Battery Service near me', '/car-services/car-battery-service', 'Mumbai', FALSE, 104
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-services/car-battery-service');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-services/car-brake-service', 'Car Brake Service', 'Car Brake Service | MyFNG', 'Brake inspection, pad replacement and safety checks at MYFNG workshops across Mumbai and Pune.', 'car brake service, car brake service near me, car service mumbai, car service pune, myfng', 'Car Brake Service near me', '/car-services/car-brake-service', 'Mumbai', FALSE, 105
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-services/car-brake-service');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-services/car-clutch-service', 'Car Clutch Service', 'Car Clutch Service | MyFNG', 'Clutch inspection, repair and replacement with transparent pricing at MYFNG garages.', 'car clutch service, car clutch service near me, car service mumbai, car service pune, myfng', 'Car Clutch Service near me', '/car-services/car-clutch-service', 'Mumbai', FALSE, 106
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-services/car-clutch-service');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-services/tyre-wheel-care', 'Car Tyre & Wheel Care', 'Car Tyre & Wheel Care | MyFNG', 'Tyre rotation, wheel alignment, balancing and care services at MYFNG workshops.', 'car tyre & wheel care, car tyre & wheel care near me, car service mumbai, car service pune, myfng', 'Car Tyre & Wheel Care near me', '/car-services/tyre-wheel-care', 'Mumbai', FALSE, 107
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-services/tyre-wheel-care');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-services/car-detailing-service', 'Car Detailing Service', 'Car Detailing Service | MyFNG', 'Interior and exterior car detailing for a refreshed look and protected finish.', 'car detailing service, car detailing service near me, car service mumbai, car service pune, myfng', 'Car Detailing Service near me', '/car-services/car-detailing-service', 'Mumbai', FALSE, 108
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-services/car-detailing-service');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-services/car-denting-painting', 'Car Denting & Painting', 'Car Denting & Painting | MyFNG', 'Body repair, dent removal and painting services at MYFNG verified body shops.', 'car denting & painting, car denting & painting near me, car service mumbai, car service pune, myfng', 'Car Denting & Painting near me', '/car-services/car-denting-painting', 'Mumbai', FALSE, 109
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-services/car-denting-painting');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-services/car-electrical-battery-service', 'Electrical & Battery Service', 'Electrical & Battery Service | MyFNG', 'Electrical diagnostics, wiring checks and battery service at MYFNG workshops.', 'electrical & battery service, electrical & battery service near me, car service mumbai, car service pune, myfng', 'Electrical & Battery Service near me', '/car-services/car-electrical-battery-service', 'Mumbai', FALSE, 110
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-services/car-electrical-battery-service');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-services/car-suspension-steering-service', 'Suspension & Steering Service', 'Suspension & Steering Service | MyFNG', 'Suspension, steering and ride comfort repairs with expert diagnostics at MYFNG.', 'suspension & steering service, suspension & steering service near me, car service mumbai, car service pune, myfng', 'Suspension & Steering Service near me', '/car-services/car-suspension-steering-service', 'Mumbai', FALSE, 111
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-services/car-suspension-steering-service');
