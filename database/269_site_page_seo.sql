-- Admin-managed SEO for MyFNG website static pages
CREATE TABLE IF NOT EXISTS public.site_page_seo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path VARCHAR(200) NOT NULL UNIQUE,
  page_label VARCHAR(120) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  keywords TEXT NOT NULL DEFAULT '',
  keyphrase VARCHAR(200) NOT NULL DEFAULT '',
  og_image TEXT NOT NULL DEFAULT '',
  canonical_path VARCHAR(200) NOT NULL,
  og_type VARCHAR(20) NOT NULL DEFAULT 'website' CHECK (og_type IN ('website', 'article')),
  city VARCHAR(80) NOT NULL DEFAULT 'Mumbai',
  noindex BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_page_seo_order ON public.site_page_seo (display_order, page_path);

COMMENT ON TABLE public.site_page_seo IS 'Admin-managed SEO metadata for MyFNG website static pages';

ALTER TABLE public.site_page_seo ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_page_seo' AND policyname = 'Allow public read for active site page seo') THEN
    CREATE POLICY "Allow public read for active site page seo"
      ON public.site_page_seo FOR SELECT
      USING (active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_page_seo' AND policyname = 'Allow admin full access site page seo') THEN
    CREATE POLICY "Allow admin full access site page seo"
      ON public.site_page_seo FOR ALL
      USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/', 'Home', 'Best Mechanic Near Me Mumbai | Best Car Repair Near Me | MyFNG', 'Best car repair & mechanic near me in Mumbai, Pune & Thane. Book periodic service, AC repair, engine service, brake service & more at verified MYFNG workshops.', 'best mechanic near me, best car repair near me, car service near me Mumbai, car service near me Pune, car servicing Mumbai, car repair Mumbai, periodic car service, MYFNG', 'best car repair near me', '/', 'Mumbai', FALSE, 1
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/about-us', 'About Us', 'About Us - MYFNG | India''s AI-Powered Car Service Platform', 'Learn about MYFNG - India''s first AI-powered car care platform. 100+ verified workshops across Mumbai, Pune, Thane & Navi Mumbai with transparent pricing.', 'about MYFNG, car service company India, verified car workshops, AI car service platform', 'about MYFNG car service', '/about-us', 'Mumbai', FALSE, 2
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/about-us');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/contact-us', 'Contact Us', 'Contact Us - MYFNG | Car Service Support', 'Contact MYFNG for car service bookings, roadside assistance & support. Call +91-8657575757 or visit our workshops in Mumbai, Pune & Thane.', 'contact MYFNG, car service contact, MYFNG customer support, car repair helpline', 'contact MYFNG car service', '/contact-us', 'Mumbai', FALSE, 3
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/contact-us');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/faqs', 'FAQs', 'FAQs - Car Service Questions Answered | MyFNG', 'Find answers to common car service questions - periodic maintenance, AC repair, engine service, pricing, pickup & delivery, and MYFNG workshop policies.', 'car service FAQ, car repair questions, MYFNG FAQ, car maintenance FAQ', 'car service FAQ', '/faqs', 'Mumbai', FALSE, 4
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/faqs');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-services', 'Car Services', 'Car Services - Periodic, AC, Engine & More | MyFNG', 'Explore all car services at MYFNG - periodic service, AC service, engine repair, brake service, battery, clutch, denting & painting across Mumbai & Pune.', 'car services, periodic car service, car AC service, car engine service, car brake service, car repair services Mumbai', 'car services near me', '/car-services', 'Mumbai', FALSE, 5
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-services');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/book-service', 'Book Service', 'Book Car Service Online | MyFNG', 'Book car service online at MYFNG. Choose your city, car model, services & workshop. Free pickup & delivery available across Mumbai, Pune & Thane.', 'book car service online, car service booking, online car repair booking, MYFNG booking', 'book car service online', '/book-service', 'Mumbai', FALSE, 6
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/book-service');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/workshop-locator', 'Workshop Locator', 'Find Car Workshops Near Me | MyFNG Verified Garages', 'Find verified MYFNG car workshops near you in Mumbai, Pune, Thane & Navi Mumbai. Compare ratings, services & book online instantly.', 'car workshop near me, garage near me, MYFNG workshops, car service center near me', 'car workshop near me', '/workshop-locator', 'Mumbai', FALSE, 7
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/workshop-locator');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/misa-ai', 'MISA AI Booking', 'AI Car Service Booking | MyFNG', 'Book car service instantly with MYFNG AI Booking Agent. Smart recommendations, transparent pricing & verified workshops in Mumbai, Pune & Thane.', 'AI car service booking, AI car repair, MYFNG AI booking', 'AI car service booking', '/misa-ai', 'Mumbai', FALSE, 8
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/misa-ai');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-roadside-assitance', 'Roadside Assistance', 'Roadside Assistance (RSA) - 24x7 Emergency Help | MyFNG', 'MYFNG Roadside Assistance - 24x7 emergency dispatch for towing, jumpstart, puncture repair, fuel delivery & on-road help across Mumbai & Pune.', 'roadside assistance, car breakdown help, emergency towing, RSA Mumbai, RSA Pune', 'roadside assistance near me', '/car-roadside-assitance', 'Mumbai', FALSE, 9
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-roadside-assitance');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/car-loan', 'Car Loan', 'Car Loan - Easy Vehicle Finance | MyFNG', 'Apply for car loan with MYFNG. Quick vehicle finance options with easy eligibility check for Mumbai, Pune & Thane customers.', 'car loan, vehicle finance, car loan Mumbai, car loan Pune', 'car loan', '/car-loan', 'Mumbai', FALSE, 10
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-loan');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/blogs', 'Blogs', 'Car Service Blogs - Tips, Guides & Maintenance | MyFNG', 'Read expert car service blogs, maintenance tips, repair guides and local SEO articles from MYFNG workshops across Mumbai, Pune & Thane.', 'car service blog, car maintenance tips, car repair guide, MYFNG blog', 'car service blog', '/blogs', 'Mumbai', FALSE, 11
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/blogs');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/privacy-policy', 'Privacy Policy', 'Privacy Policy | MyFNG', 'Read MYFNG Privacy Policy. Learn how we collect, use and protect your personal data when you book car services on myfng.in.', 'MYFNG privacy policy, data protection, car service privacy', '', '/privacy-policy', 'Mumbai', TRUE, 12
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/privacy-policy');

INSERT INTO public.site_page_seo (page_path, page_label, title, description, keywords, keyphrase, canonical_path, city, noindex, display_order)
SELECT '/terms-and-conditions', 'Terms & Conditions', 'Terms and Conditions | MyFNG', 'Read MYFNG Terms and Conditions for car service bookings, workshop policies, payments, cancellations and customer responsibilities.', 'MYFNG terms and conditions, car service terms, booking policy', '', '/terms-and-conditions', 'Mumbai', TRUE, 13
WHERE NOT EXISTS (SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/terms-and-conditions');
