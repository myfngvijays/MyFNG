-- Competitor Intel: public-page SEO / AIO claim monitor (CarYaar first).
-- Super Admin → Competitor Intel → Competitors (not inside Advanced SEO).
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  website_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  seed_paths TEXT[] NOT NULL DEFAULT ARRAY['/']::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.competitor_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  path TEXT NOT NULL,
  title TEXT,
  h1 TEXT,
  meta_description TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  aio_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash TEXT,
  word_count INT NOT NULL DEFAULT 0,
  http_status INT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competitor_id, url)
);

CREATE INDEX IF NOT EXISTS idx_competitor_pages_comp_seen
  ON public.competitor_pages (competitor_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.competitor_page_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.competitor_pages(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT,
  h1 TEXT,
  meta_description TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  aio_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash TEXT,
  word_count INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_competitor_snapshots_page
  ON public.competitor_page_snapshots (page_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS public.competitor_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.competitor_pages(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL,
  field_name TEXT,
  before_value TEXT,
  after_value TEXT,
  url TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitor_changes_comp
  ON public.competitor_changes (competitor_id, detected_at DESC);

CREATE TABLE IF NOT EXISTS public.competitor_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  source_url TEXT,
  hit_count INT NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competitor_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_competitor_keywords_comp
  ON public.competitor_keywords (competitor_id, hit_count DESC, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.competitor_aio_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  competitor_claim TEXT NOT NULL,
  myfng_counter TEXT NOT NULL,
  suggested_action TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competitor_id, dimension)
);

CREATE TABLE IF NOT EXISTS public.competitor_crawl_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  pages_scanned INT NOT NULL DEFAULT 0,
  new_pages INT NOT NULL DEFAULT 0,
  changed_pages INT NOT NULL DEFAULT 0,
  keywords_upserted INT NOT NULL DEFAULT 0,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_competitor_crawl_runs_comp
  ON public.competitor_crawl_runs (competitor_id, started_at DESC);

COMMENT ON TABLE public.competitors IS
  'Public competitor sites monitored for SEO / AI Overview claim diffs.';
COMMENT ON TABLE public.competitor_aio_gaps IS
  'AIO comparison dimensions. Admin-only. Public MyFNG content must not name the competitor.';

ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_page_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_aio_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_crawl_runs ENABLE ROW LEVEL SECURITY;

INSERT INTO public.competitors (slug, name, domain, website_url, notes, seed_paths)
VALUES (
  'caryaar',
  'CarYaar',
  'caryaar.com',
  'https://caryaar.com',
  'Mumbai WhatsApp-native car service. Track public pages, keywords, and AI Overview claims only.',
  ARRAY['/', '/services']::TEXT[]
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  website_url = EXCLUDED.website_url,
  seed_paths = EXCLUDED.seed_paths,
  updated_at = now();
