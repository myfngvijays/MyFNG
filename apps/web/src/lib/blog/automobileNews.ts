import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isBlogIndexable } from '@/lib/blog/seo';
import { normalizeBlogMediaUrl } from '@/lib/blog/normalizeBlogMedia';
import { resolveNewsTopic, type NewsTopic } from '@/lib/blog/newsTopic';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const AUTOMOBILE_NEWS_PAGE_SIZE = 8;

const NEWS_CAR_SLUGS = [
  'curvv-series-x-first-service-thane',
  'baleno-facelift-first-service-checklist-navi-mumbai',
  'kia-sorento-diesel-first-service-checklist-pune',
  'hyundai-bayon-india-launch-mumbai',
  'triber-turbo-first-service-thane',
];

export type AutomobileNewsItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  image: string | null;
  publishedAt: string | null;
  readTime: number;
  views: number;
  category: string | null;
  topic: NewsTopic;
};

type NewsRow = {
  id: string;
  slug: string;
  title?: string | null;
  excerpt?: string | null;
  featured_image?: string | null;
  published_at?: string | null;
  read_time?: number | null;
  views?: number | null;
  seo_data?: unknown;
  category?: { name?: string | null; slug?: string | null } | { name?: string | null; slug?: string | null }[] | null;
  categories?: Array<{ category?: { name?: string | null; slug?: string | null } | null }>;
};

function categoryLabels(row: NewsRow) {
  const primary = Array.isArray(row.category) ? row.category[0] : row.category;
  const mapped = (row.categories || []).flatMap((item) => {
    const category = item?.category;
    return [category?.name, category?.slug];
  });
  return [primary?.name, primary?.slug, ...mapped].map((value) => String(value || '').trim()).filter(Boolean);
}

export function isAutomobileNewsRow(row: NewsRow) {
  const seo = row.seo_data && typeof row.seo_data === 'object' ? (row.seo_data as { ai_news_car?: unknown }) : {};
  if (seo.ai_news_car === true || seo.ai_news_car === 'true') return true;
  if (NEWS_CAR_SLUGS.includes(String(row.slug || ''))) return true;
  return categoryLabels(row).some((label) => /automobile news|car news|auto news|new cars?/i.test(label));
}

function newsClient(): SupabaseClient | null {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (supabaseAdmin) return supabaseAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function mapItem(row: NewsRow): AutomobileNewsItem {
  const primary = Array.isArray(row.category) ? row.category[0] : row.category;
  const title = String(row.title || '').trim();
  const excerpt = String(row.excerpt || '').trim();
  const seo = row.seo_data && typeof row.seo_data === 'object' ? row.seo_data as { news_topic?: unknown } : {};
  return {
    id: String(row.id),
    slug: String(row.slug),
    title,
    excerpt,
    image: normalizeBlogMediaUrl(row.featured_image),
    publishedAt: row.published_at ? String(row.published_at) : null,
    readTime: Number(row.read_time || 0) || 3,
    views: Number(row.views || 0),
    category: primary?.name ? String(primary.name) : 'Automobile News',
    topic: resolveNewsTopic(seo.news_topic, title, excerpt),
  };
}

export function pickRelatedNews(items: AutomobileNewsItem[], currentSlug: string, topic: string, count = 3) {
  const rest = items.filter((item) => item.slug !== currentSlug);
  const same = rest.filter((item) => item.topic === topic);
  const others = rest.filter((item) => item.topic !== topic);
  return [...same, ...others].slice(0, count);
}

export async function getAutomobileNewsArticle(slug: string) {
  const client = newsClient();
  const clean = String(slug || '').trim();
  if (!client || !clean) return null;

  const { data, error } = await client
    .from('blogs')
    .select(`
      id, slug, title, excerpt, content, featured_image, published_at, read_time, views, seo_data,
      category:blog_categories(name, slug),
      categories:blog_category_mapping(category:blog_categories(name, slug))
    `)
    .eq('slug', clean)
    .ilike('status', 'published')
    .maybeSingle();

  if (error || !data) return null;
  const row = data as NewsRow & { content?: string | null };
  if (!isBlogIndexable(row.seo_data) || !isAutomobileNewsRow(row)) return null;
  const seo = row.seo_data && typeof row.seo_data === 'object' ? row.seo_data as { news_photo_caption?: unknown } : {};
  return {
    ...mapItem(row),
    content: String(row.content || ''),
    photoCaption: String(seo.news_photo_caption || '').trim(),
    seo: row.seo_data,
  };
}

export async function listAutomobileNews(page = 1, pageSize = AUTOMOBILE_NEWS_PAGE_SIZE) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : AUTOMOBILE_NEWS_PAGE_SIZE;
  const client = newsClient();
  if (!client) {
    return { items: [] as AutomobileNewsItem[], total: 0, page: safePage, pageSize: size };
  }

  const start = (safePage - 1) * size;
  const newsFilter = `seo_data->>ai_news_car.eq.true,slug.in.(${NEWS_CAR_SLUGS.join(',')})`;
  const { data, error, count } = await client
    .from('blogs')
    .select(
      `
      id, slug, title, excerpt, featured_image, published_at, read_time, views, seo_data,
      category:blog_categories(name, slug)
    `,
      { count: 'exact' },
    )
    .ilike('status', 'published')
    .or(newsFilter)
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(start, start + size - 1);

  if (error || !data) {
    console.error('Automobile news list failed', error?.message || error);
    return { items: [] as AutomobileNewsItem[], total: 0, page: safePage, pageSize: size };
  }

  const news = (data as NewsRow[]).filter((row) => isBlogIndexable(row.seo_data) && isAutomobileNewsRow(row));
  return {
    items: news.map(mapItem),
    total: count ?? news.length,
    page: safePage,
    pageSize: size,
  };
}

export async function listMyfngBlogsForNews(seed: string, count = 3) {
  const client = newsClient();
  if (!client) return [] as Array<{ slug: string; title: string }>;
  const { data, error } = await client
    .from('blogs')
    .select('id, slug, title, seo_data')
    .ilike('status', 'published')
    .order('published_at', { ascending: false })
    .limit(80);
  if (error || !data) return [];
  const blogs = (data as NewsRow[]).filter((row) => {
    return Boolean(row.slug && row.title) && isBlogIndexable(row.seo_data) && !isAutomobileNewsRow(row);
  });
  if (!blogs.length) return [];
  let hash = 0;
  for (const char of String(seed || 'news')) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  const start = hash % blogs.length;
  return Array.from({ length: Math.min(count, blogs.length) }, (_, index) => {
    const row = blogs[(start + index) % blogs.length];
    return { slug: String(row.slug), title: String(row.title || '').trim() };
  });
}
