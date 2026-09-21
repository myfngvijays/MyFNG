export const COMPETITOR_TABLES = {
  competitors: 'competitors',
  pages: 'competitor_pages',
  snapshots: 'competitor_page_snapshots',
  changes: 'competitor_changes',
  keywords: 'competitor_keywords',
  aioGaps: 'competitor_aio_gaps',
  runs: 'competitor_crawl_runs',
} as const;

export const AIO_DIMENSIONS = ['app', 'price', 'network', 'warranty', 'local', 'hours'] as const;
export type AioDimension = (typeof AIO_DIMENSIONS)[number];

export type AioClaim = {
  dimension: AioDimension;
  text: string;
};

export type CompetitorRow = {
  id: string;
  slug: string;
  name: string;
  domain: string;
  website_url: string;
  active: boolean;
  notes: string | null;
  seed_paths: string[];
  created_at: string;
  updated_at: string;
};

export type CompetitorPageRow = {
  id: string;
  competitor_id: string;
  url: string;
  path: string;
  title: string | null;
  h1: string | null;
  meta_description: string | null;
  keywords: string[];
  aio_claims: AioClaim[];
  content_hash: string | null;
  word_count: number;
  http_status: number | null;
  first_seen_at: string;
  last_seen_at: string;
  last_changed_at: string | null;
};

export type CompetitorChangeRow = {
  id: string;
  competitor_id: string;
  page_id: string | null;
  change_type: string;
  field_name: string | null;
  before_value: string | null;
  after_value: string | null;
  url: string | null;
  detected_at: string;
};

export type CompetitorKeywordRow = {
  id: string;
  competitor_id: string;
  keyword: string;
  source_url: string | null;
  hit_count: number;
  first_seen_at: string;
  last_seen_at: string;
};

export type CompetitorAioGapRow = {
  id: string;
  competitor_id: string;
  dimension: AioDimension;
  competitor_claim: string;
  myfng_counter: string;
  suggested_action: string | null;
  status: 'open' | 'covered' | 'ignored';
  created_at: string;
  updated_at: string;
};

export type CompetitorCrawlRunRow = {
  id: string;
  competitor_id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  pages_scanned: number;
  new_pages: number;
  changed_pages: number;
  keywords_upserted: number;
  error: string | null;
};

export function isMissingTableError(error: { message?: string } | null | undefined) {
  return /does not exist|42P01|relation .*competitors/i.test(String(error?.message || ''));
}
