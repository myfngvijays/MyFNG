-- Admin-editable live SEO files (robots, sitemap, manifest, llms.txt, etc.)
CREATE TABLE IF NOT EXISTS public.site_seo_live_files (
  file_key TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  use_custom BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.site_seo_live_files IS 'Optional manual overrides for live SEO/crawl files on myfng.in';

ALTER TABLE public.site_seo_live_files ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_seo_live_files' AND policyname = 'Allow public read site seo live files') THEN
    CREATE POLICY "Allow public read site seo live files"
      ON public.site_seo_live_files FOR SELECT
      USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_seo_live_files' AND policyname = 'Allow admin full access site seo live files') THEN
    CREATE POLICY "Allow admin full access site seo live files"
      ON public.site_seo_live_files FOR ALL
      USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.site_seo_live_files (file_key, content, use_custom) VALUES
  ('sitemap_xml', '', FALSE),
  ('robots_txt', '', FALSE),
  ('manifest_json', '', FALSE),
  ('llms_txt', '', FALSE),
  ('security_txt', '', FALSE),
  ('humans_txt', '', FALSE)
ON CONFLICT (file_key) DO NOTHING;
