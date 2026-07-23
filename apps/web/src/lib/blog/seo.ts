import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export type BlogSeoData = {
  meta_title?: string;
  meta_description?: string;
  keywords?: string;
  canonical_url?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  robots_index?: boolean;
  robots_follow?: boolean;
  schema_blogposting?: boolean;
  schema_faq?: boolean;
  eligible_ai_overview?: boolean;
  author_name?: string;
  author_role?: string;
  cta_text?: string;
  cta_url?: string;
  search_intent?: string;
  local_city?: string;
  local_areas?: string[];
  geo_lat?: number;
  geo_lng?: number;
  geo_region?: string;
  geo_placename?: string;
  featured_image_alt?: string;
  keyphrase?: string;
  keyphrase_description?: string;
  google_ai_overview?: boolean;
  serp_tag?: string;
  faqs?: Array<{ question: string; answer: string }>;
};

export function parseBlogSeoData(raw: unknown): BlogSeoData {
  if (!raw || typeof raw !== 'object') return {};
  return raw as BlogSeoData;
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'how', 'i', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'were', 'what', 'when', 'where', 'which', 'who', 'why', 'with',
  'your', 'you', 'we', 'our', 'myfng', 'car', 'cars', 'service', 'services', 'best', 'near', 'nearby', 'at',
]);

function normalizeKeywordWord(w: string) {
  return String(w || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export function extractKeywordsFromSummary(summary: string, max = 10): string {
  const text = String(summary || '').trim();
  if (!text) return '';

  const words = text
    .split(/\s+/)
    .map((w) => normalizeKeywordWord(w))
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, max)
    .join(', ');
}

export function autoFillSeoFromSummary(
  excerpt: string | null | undefined,
  seoData: BlogSeoData | Record<string, unknown> | null | undefined,
): BlogSeoData {
  const seo: BlogSeoData = { ...parseBlogSeoData(seoData) };
  const summary = String(excerpt || '').trim();
  if (!summary) return seo;

  if (!String(seo.meta_description || '').trim()) {
    seo.meta_description = summary.slice(0, 155);
  }

  if (!String(seo.keywords || '').trim()) {
    seo.keywords = extractKeywordsFromSummary(summary, 10);
  }

  return seo;
}

export function isBlogIndexable(seoData: unknown): boolean {
  const seo = parseBlogSeoData(seoData);
  return seo.robots_index !== false;
}

export function blogSeoToSummary(row: {
  id: string;
  slug: string;
  title?: string | null;
  excerpt?: string | null;
  status?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  seo_data?: unknown;
}) {
  const seo = parseBlogSeoData(row.seo_data);
  return {
    id: String(row.id),
    slug: String(row.slug),
    page_label: String(seo.meta_title || row.title || row.slug).trim(),
    title: String(seo.meta_title || row.title || '').trim(),
    description: String(seo.meta_description || row.excerpt || '').trim(),
    keywords: String(seo.keywords || '').trim(),
    indexable: isBlogIndexable(row.seo_data),
    status: String(row.status || ''),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    published_at: row.published_at ? String(row.published_at) : undefined,
    edit_href: `/dashboard/digital_marketing/blogs/${row.id}/edit`,
    preview_href: `/blogs/${row.slug}`,
  };
}

export type BlogSeoSummary = ReturnType<typeof blogSeoToSummary>;

export async function listBlogSeoSummaries(): Promise<BlogSeoSummary[]> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];

  const { data, error } = await supabaseAdmin
    .from('blogs')
    .select('id, slug, title, excerpt, status, updated_at, published_at, seo_data')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (error || !data) return [];
  return data.map((row: any) => blogSeoToSummary(row));
}

export async function listBlogListingSchemaItems(limit = 8): Promise<Array<{ name: string; url: string }>> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];

  const { data, error } = await supabaseAdmin
    .from('blogs')
    .select('slug, title, seo_data')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data
    .filter((row: any) => isBlogIndexable(row.seo_data))
    .map((row: any) => ({
      name: String(parseBlogSeoData(row.seo_data).meta_title || row.title || row.slug),
      url: `https://myfng.in/blogs/${row.slug}`,
    }));
}
