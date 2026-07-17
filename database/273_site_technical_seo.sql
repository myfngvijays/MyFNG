-- Admin-managed technical SEO settings (singleton row)
CREATE TABLE IF NOT EXISTS public.site_technical_seo (
  config_key TEXT PRIMARY KEY DEFAULT 'default',
  google_verification TEXT NOT NULL DEFAULT '',
  bing_verification TEXT NOT NULL DEFAULT '',
  yandex_verification TEXT NOT NULL DEFAULT '',
  default_title TEXT NOT NULL DEFAULT 'My FNG - India''s First AI-Powered Car Service Booking Platform',
  default_description TEXT NOT NULL DEFAULT 'India''s first AI-powered car service booking platform. Book periodic service, AC repair, engine service & more at verified workshops in Mumbai, Pune & Thane.',
  twitter_site TEXT NOT NULL DEFAULT '@myfngcarservice',
  theme_color TEXT NOT NULL DEFAULT '#dc2626',
  manifest_name TEXT NOT NULL DEFAULT 'MYFNG - Car Service & Repairs',
  manifest_short_name TEXT NOT NULL DEFAULT 'MYFNG',
  manifest_description TEXT NOT NULL DEFAULT 'Book car service online at verified MYFNG workshops across Mumbai, Pune, Thane and Navi Mumbai.',
  organization_same_as TEXT NOT NULL DEFAULT '',
  extra_robots_disallow TEXT NOT NULL DEFAULT '',
  security_contact_email TEXT NOT NULL DEFAULT 'support@myfng.in',
  security_contact_phone TEXT NOT NULL DEFAULT '+91-8657575757',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.site_technical_seo IS 'Singleton technical SEO settings for myfng.in';

ALTER TABLE public.site_technical_seo ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_technical_seo' AND policyname = 'Allow public read site technical seo') THEN
    CREATE POLICY "Allow public read site technical seo"
      ON public.site_technical_seo FOR SELECT
      USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_technical_seo' AND policyname = 'Allow admin full access site technical seo') THEN
    CREATE POLICY "Allow admin full access site technical seo"
      ON public.site_technical_seo FOR ALL
      USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.site_technical_seo (
  config_key,
  organization_same_as
) VALUES (
  'default',
  E'https://www.facebook.com/myfng\nhttps://www.instagram.com/myfng\nhttps://www.linkedin.com/company/myfng\nhttps://x.com/myfngcarservice\nhttps://www.youtube.com/@myfng_car_servicing'
)
ON CONFLICT (config_key) DO NOTHING;
