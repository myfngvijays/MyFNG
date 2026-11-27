/**
 * Public Blog API Route
 * GET /api/blogs/public - Get published blogs (no authentication required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeReadTimeFromHtml } from '@/lib/blog/text';
import { ensureSeoBlogTitle } from '@/lib/blog/generateAiDraft';
import { PUBLIC_BLOG_AUTHOR } from '@/lib/blog/publicAuthor';
import { normalizeBlogMediaAbsoluteUrl, normalizeBlogRecordForResponse } from '@/lib/blog/normalizeBlogMedia';
import { slotIsoForRunDate } from '@/lib/blog/dailyBlogSlots';
import { isAutomobileNewsRow } from '@/lib/blog/automobileNews';

export const dynamic = 'force-dynamic';

const LIST_SELECT = `
  id,
  slug,
  title,
  excerpt,
  status,
  views,
  read_time,
  created_at,
  published_at,
  featured_image,
  category_id,
  seo_data,
  category:blog_categories(id, name, slug),
  tags:blog_tag_mapping(
    tag:blog_tags(name, slug)
  )
`;

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' };

let newsCategoryIdsCache: string[] | null = null;
let newsCategoryIdsAt = 0;

function kolkataDateKey(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

async function getAutomobileNewsCategoryIds(supabase: ReturnType<typeof createClient>) {
  if (newsCategoryIdsCache && Date.now() - newsCategoryIdsAt < 300_000) {
    return newsCategoryIdsCache;
  }
  const { data: newsCategories } = await supabase
    .from('blog_categories')
    .select('id')
    .or('slug.eq.automobile-news,slug.eq.car-news,name.ilike.%Automobile News%');
  newsCategoryIdsCache = (newsCategories || [])
    .map((row: { id?: string }) => row.id)
    .filter(Boolean) as string[];
  newsCategoryIdsAt = Date.now();
  return newsCategoryIdsCache;
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const searchParams = request.nextUrl.searchParams;

    if (searchParams.get('calendar') === '1') {
      const newsCategoryIds = await getAutomobileNewsCategoryIds(supabase);
      let calQuery = supabase
        .from('blogs')
        .select('published_at, created_at, category_id')
        .ilike('status', 'published')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(600);
      if (newsCategoryIds.length) {
        calQuery = calQuery.not('category_id', 'in', `(${newsCategoryIds.join(',')})`);
      }
      const { data: rows, error: calErr } = await calQuery;
      if (calErr) {
        return NextResponse.json({ error: 'Failed to load calendar' }, { status: 500 });
      }
      const counts: Record<string, number> = {};
      for (const row of rows || []) {
        const key = kolkataDateKey(row.published_at || row.created_at);
        if (!key) continue;
        counts[key] = (counts[key] || 0) + 1;
      }
      return NextResponse.json({ counts }, { headers: CACHE_HEADERS });
    }

    const category_id = searchParams.get('category_id');
    const tag_id = searchParams.get('tag_id');
    const search = String(searchParams.get('search') || searchParams.get('q') || '').trim();
    const featured = searchParams.get('featured') === 'true';
    const dateYmd = String(searchParams.get('date') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20', 10)), 100);
    const offset = searchParams.has('offset')
      ? Math.max(0, parseInt(searchParams.get('offset') || '0', 10))
      : (page - 1) * limit;

    let query = supabase
      .from('blogs')
      .select(LIST_SELECT, { count: 'exact' })
      .ilike('status', 'published');

    if (featured) {
      query = query.eq('is_featured', true);
    }

    if (search) {
      const safe = search.replace(/[%_,]/g, ' ').trim();
      if (safe) {
        query = query.or(`title.ilike.%${safe}%,excerpt.ilike.%${safe}%`);
      }
    }

    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    if (dateYmd && /^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
      const start = new Date(`${dateYmd}T00:00:00+05:30`).toISOString();
      const end = new Date(`${dateYmd}T23:59:59.999+05:30`).toISOString();
      query = query.gte('published_at', start).lte('published_at', end);
    }

    const newsCategoryIds = await getAutomobileNewsCategoryIds(supabase);
    if (newsCategoryIds.length) {
      query = query.not('category_id', 'in', `(${newsCategoryIds.join(',')})`);
    }

    query = query
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: blogs, error, count } = await query;

    if (error) {
      console.error('Blog fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch blogs', details: error.message }, { status: 500 });
    }

    let filteredBlogs = blogs || [];
    if (tag_id) {
      filteredBlogs = filteredBlogs.filter((blog: any) => {
        const blogTags = blog.tags?.map((t: any) => t.tag?.id || t.tag_id) || [];
        return blogTags.includes(tag_id);
      });
    }
    filteredBlogs = filteredBlogs.filter((blog: any) => !isAutomobileNewsRow(blog));

    const total = tag_id ? filteredBlogs.length : count || 0;

    const transformedBlogs = filteredBlogs.map((blog: any) => {
      const seo = blog.seo_data || {};
      const city = String(seo.local_city || seo.ai_city || '').trim();
      const title =
        city && (seo.ai_daily_post || seo.ai_batch_post)
          ? ensureSeoBlogTitle(String(blog.title || ''), city)
          : blog.title;
      const assigned = String(seo.ai_run_date || '').slice(0, 10);
      const publishedAt =
        seo.ai_daily_post && /^\d{4}-\d{2}-\d{2}$/.test(assigned)
          ? slotIsoForRunDate(String(seo.ai_slot_time || '10:00'), assigned)
          : blog.published_at;
      const storedRead = Number(blog.read_time);
      const read_time =
        Number.isFinite(storedRead) && storedRead > 0
          ? storedRead
          : computeReadTimeFromHtml(String(blog.excerpt || '')).minutes;
      const normalized = normalizeBlogRecordForResponse({
        ...blog,
        title,
        published_at: publishedAt,
        read_time,
        author: { full_name: PUBLIC_BLOG_AUTHOR },
        tags: blog.tags?.map((t: any) => t.tag).filter(Boolean) || [],
      });
      return {
        ...normalized,
        featured_image_url: normalizeBlogMediaAbsoluteUrl(String(normalized.featured_image || '')),
      };
    });

    return NextResponse.json(
      {
        blogs: transformedBlogs,
        pagination: {
          page,
          limit,
          offset,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
      { headers: CACHE_HEADERS },
    );
  } catch (error: any) {
    console.error('Error in public blog API:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}