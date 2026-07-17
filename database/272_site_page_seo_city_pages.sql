-- Phase 3: city landing page SEO seeds
INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-service-in/mumbai', 'Car Service Mumbai', 'Best Car Service in Mumbai | Periodic, AC & Engine Repair | MyFNG', 'Book car service in Mumbai at verified MYFNG workshops. Periodic service, AC repair, engine service, brake service with transparent pricing and free pickup & delivery.', 'car service Mumbai, car repair Mumbai, best mechanic Mumbai, car workshop Mumbai, MYFNG', 'car service Mumbai', '/car-service-in/mumbai', 'Mumbai', FALSE, 201
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-service-in/mumbai');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-service-in/pune', 'Car Service Pune', 'Best Car Service in Pune | Periodic, AC & Engine Repair | MyFNG', 'Book car service in Pune at verified MYFNG workshops. Periodic service, AC repair, engine service, brake service with transparent pricing and free pickup & delivery.', 'car service Pune, car repair Pune, best mechanic Pune, car workshop Pune, MYFNG', 'car service Pune', '/car-service-in/pune', 'Pune', FALSE, 202
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-service-in/pune');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-service-in/thane', 'Car Service Thane', 'Best Car Service in Thane | Periodic, AC & Engine Repair | MyFNG', 'Book car service in Thane at verified MYFNG workshops. Periodic service, AC repair, engine service, brake service with transparent pricing and free pickup & delivery.', 'car service Thane, car repair Thane, best mechanic Thane, car workshop Thane, MYFNG', 'car service Thane', '/car-service-in/thane', 'Thane', FALSE, 203
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-service-in/thane');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-service-in/navi-mumbai', 'Car Service Navi Mumbai', 'Best Car Service in Navi Mumbai | Periodic, AC & Engine Repair | MyFNG', 'Book car service in Navi Mumbai at verified MYFNG workshops. Periodic service, AC repair, engine service, brake service with transparent pricing and free pickup & delivery.', 'car service Navi Mumbai, car repair Navi Mumbai, best mechanic Navi Mumbai, car workshop Navi Mumbai, MYFNG', 'car service Navi Mumbai', '/car-service-in/navi-mumbai', 'Navi Mumbai', FALSE, 204
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-service-in/navi-mumbai');
