import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { BATCH_BLOG_TOPICS, THANE_BATCH_CITY, batchBlogKey } from '@/lib/blog/batchBlogTopics';
import {
  PACKAGE_EDUCATION_TOPICS,
  packageEducationBlogKey,
} from '@/lib/blog/packageEducationBlogTopics';
import { RSA_BLOG_TOPICS, rsaBlogKey } from '@/lib/blog/rsaBlogTopics';
import { rsaCityByIndex } from '@/lib/blog/dailyCities';
import { DAILY_BLOG_COVERS, uploadDailyCoverWebp } from '@/lib/blog/dailyCovers';
import { istDateString } from '@/lib/blog/dailyTopics';
import { ensureSeoBlogTitle } from '@/lib/blog/generateAiDraft';
import { loadDailyBlogSettings } from '@/lib/blog/runDailyBlogPost';
import { publishAiServiceBlog, type DailyBlogRunResult } from '@/lib/blog/publishAiServiceBlog';

export const NEWS_CAR_SLUGS = [
  'curvv-series-x-first-service-thane',
  'baleno-facelift-first-service-checklist-navi-mumbai',
  'kia-sorento-diesel-first-service-checklist-pune',
  'hyundai-bayon-india-launch-mumbai',
  'triber-turbo-first-service-thane',
];

export function batchCoverByIndex(index: number) {
  return DAILY_BLOG_COVERS[((index % DAILY_BLOG_COVERS.length) + DAILY_BLOG_COVERS.length) % DAILY_BLOG_COVERS.length];
}

export async function runBatchBlogPost(opts: { index: number }): Promise<DailyBlogRunResult & {
  index: number;
  news?: boolean;
}> {
  const index = Number(opts.index);
  if (!Number.isInteger(index) || index < 0 || index >= BATCH_BLOG_TOPICS.length) {
    return { success: false, error: `index must be 0-${BATCH_BLOG_TOPICS.length - 1}`, index };
  }

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { success: false, error: adminError || 'Admin client not configured', index };
  }

  const loaded = await loadDailyBlogSettings();
  if (loaded.missing) {
    return { success: false, error: 'Migration 365_daily_blog_auto_post.sql is not applied', index };
  }
  if (!loaded.settings) {
    return { success: false, error: loaded.error || 'Daily blog settings missing', index };
  }

  const picked = BATCH_BLOG_TOPICS[index];
  const cityTarget = THANE_BATCH_CITY;
  const cover = batchCoverByIndex(index);
  const batchKey = batchBlogKey(index);
  const runDate = istDateString();

  const { data: existingRows } = await supabaseAdmin
    .from('blogs')
    .select('id, slug, title, seo_data')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(250);
  const existing = (existingRows || []).find((row: any) => row?.seo_data?.ai_batch_key === batchKey);

  if (existing?.id) {
    return {
      success: true,
      skipped: true,
      reason: 'already_posted',
      blog_id: existing.id,
      slug: existing.slug,
      title: existing.title,
      topic: picked.topic,
      cover_key: cover.key,
      run_date: runDate,
      index,
      news: Boolean(picked.news),
    };
  }

  try {
    const published = await publishAiServiceBlog({
      supabaseAdmin,
      settings: loaded.settings,
      picked,
      cityTarget,
      cover,
      runDate,
      notify: false,
      seoExtra: {
        ai_batch_post: true,
        ai_batch_key: batchKey,
        ai_news_car: Boolean(picked.news),
      },
    });
    return { ...published, index, news: Boolean(picked.news) };
  } catch (error: any) {
    return {
      success: false,
      error: String(error?.message || error || 'Batch blog failed').slice(0, 500),
      topic: picked.topic,
      cover_key: cover.key,
      run_date: runDate,
      index,
      news: Boolean(picked.news),
    };
  }
}

export async function runPackageEducationBlogPost(opts: { index: number }): Promise<DailyBlogRunResult & {
  index: number;
  package_edu?: boolean;
}> {
  const index = Number(opts.index);
  if (!Number.isInteger(index) || index < 0 || index >= PACKAGE_EDUCATION_TOPICS.length) {
    return { success: false, error: `index must be 0-${PACKAGE_EDUCATION_TOPICS.length - 1}`, index };
  }

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { success: false, error: adminError || 'Admin client not configured', index };
  }

  const loaded = await loadDailyBlogSettings();
  if (loaded.missing) {
    return { success: false, error: 'Migration 365_daily_blog_auto_post.sql is not applied', index };
  }
  if (!loaded.settings) {
    return { success: false, error: loaded.error || 'Daily blog settings missing', index };
  }

  const picked = PACKAGE_EDUCATION_TOPICS[index];
  const cityTarget = THANE_BATCH_CITY;
  const cover = batchCoverByIndex(index);
  const batchKey = packageEducationBlogKey(index);
  const runDate = istDateString();

  const { data: existingRows } = await supabaseAdmin
    .from('blogs')
    .select('id, slug, title, seo_data')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(250);
  const existing = (existingRows || []).find((row: any) => row?.seo_data?.ai_batch_key === batchKey);
  if (existing?.id) {
    return {
      success: true,
      skipped: true,
      reason: 'already_posted',
      blog_id: existing.id,
      slug: existing.slug,
      title: existing.title,
      topic: picked.topic,
      cover_key: cover.key,
      run_date: runDate,
      index,
      package_edu: true,
    };
  }

  try {
    const published = await publishAiServiceBlog({
      supabaseAdmin,
      settings: loaded.settings,
      picked,
      cityTarget,
      cover,
      runDate,
      notify: false,
      seoExtra: {
        ai_batch_post: true,
        ai_batch_key: batchKey,
        ai_package_post: true,
      },
    });
    return { ...published, index, package_edu: true };
  } catch (error: any) {
    return {
      success: false,
      error: String(error?.message || error || 'Package education blog failed').slice(0, 500),
      topic: picked.topic,
      cover_key: cover.key,
      run_date: runDate,
      index,
      package_edu: true,
    };
  }
}

export async function runRsaBatchBlogPost(opts: { index: number }): Promise<DailyBlogRunResult & {
  index: number;
  rsa?: boolean;
}> {
  const index = Number(opts.index);
  if (!Number.isInteger(index) || index < 0 || index >= RSA_BLOG_TOPICS.length) {
    return { success: false, error: `index must be 0-${RSA_BLOG_TOPICS.length - 1}`, index };
  }

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { success: false, error: adminError || 'Admin client not configured', index };
  }

  const loaded = await loadDailyBlogSettings();
  if (loaded.missing) {
    return { success: false, error: 'Migration 365_daily_blog_auto_post.sql is not applied', index };
  }
  if (!loaded.settings) {
    return { success: false, error: loaded.error || 'Daily blog settings missing', index };
  }

  const picked = RSA_BLOG_TOPICS[index];
  const cityTarget = rsaCityByIndex(index);
  const cover = batchCoverByIndex(index);
  const batchKey = rsaBlogKey(index);
  const runDate = istDateString();

  const { data: existingRows } = await supabaseAdmin
    .from('blogs')
    .select('id, slug, title, seo_data')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(250);
  const existing = (existingRows || []).find((row: any) => row?.seo_data?.ai_batch_key === batchKey);

  if (existing?.id) {
    return {
      success: true,
      skipped: true,
      reason: 'already_posted',
      blog_id: existing.id,
      slug: existing.slug,
      title: existing.title,
      topic: picked.topic,
      cover_key: cover.key,
      run_date: runDate,
      index,
      rsa: true,
    };
  }

  try {
    const published = await publishAiServiceBlog({
      supabaseAdmin,
      settings: loaded.settings,
      picked,
      cityTarget,
      cover,
      runDate,
      notify: false,
      seoExtra: {
        ai_batch_post: true,
        ai_batch_key: batchKey,
        ai_rsa_post: true,
      },
    });
    return { ...published, index, rsa: true };
  } catch (error: any) {
    return {
      success: false,
      error: String(error?.message || error || 'RSA blog failed').slice(0, 500),
      topic: picked.topic,
      cover_key: cover.key,
      run_date: runDate,
      index,
      rsa: true,
    };
  }
}

async function listPublishedBatchBlogs(supabaseAdmin: any) {
  const { data: rows } = await supabaseAdmin
    .from('blogs')
    .select('id, slug, title, seo_data, featured_image')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(120);
  return (rows || []).filter((row: any) => {
    const seo = row?.seo_data || {};
    return Boolean(seo.ai_batch_post || seo.ai_daily_post);
  });
}

function isNewsCarRow(row: any) {
  return Boolean(row?.seo_data?.ai_news_car) || NEWS_CAR_SLUGS.includes(String(row?.slug || ''));
}

export async function deleteNewsCarBlogs() {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { success: false as const, error: adminError || 'Admin client not configured', deleted: [] as string[] };
  }

  const { data: bySlug } = await supabaseAdmin
    .from('blogs')
    .select('id, slug, title, seo_data')
    .in('slug', NEWS_CAR_SLUGS);
  const rows = await listPublishedBatchBlogs(supabaseAdmin);
  const merged = new Map<string, any>();
  for (const row of [...(bySlug || []), ...rows.filter(isNewsCarRow)]) {
    merged.set(row.id, row);
  }
  const news = [...merged.values()];
  const deleted: string[] = [];

  for (const blog of news) {
    await supabaseAdmin.from('blog_faqs').delete().eq('blog_id', blog.id);
    await supabaseAdmin.from('blog_tag_mapping').delete().eq('blog_id', blog.id);
    await supabaseAdmin.from('blog_category_mapping').delete().eq('blog_id', blog.id);
    await supabaseAdmin.from('blog_comments').delete().eq('blog_id', blog.id);
    const { error } = await supabaseAdmin.from('blogs').delete().eq('id', blog.id);
    if (!error) deleted.push(blog.slug);
  }

  return { success: true as const, deleted, count: deleted.length };
}

export async function refreshBatchCoverAt(opts: { offset: number }) {
  const offset = Math.max(0, Number(opts.offset) || 0);
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { success: false, error: adminError || 'Admin client not configured', offset };
  }

  const remaining = (await listPublishedBatchBlogs(supabaseAdmin)).filter((row) => !isNewsCarRow(row));
  const blog = remaining[offset];
  if (!blog?.id) {
    return { success: true, skipped: true, reason: 'done', offset, remaining: remaining.length };
  }

  const seo = { ...(blog.seo_data || {}) } as Record<string, unknown>;
  const city = String(seo.local_city || seo.ai_city || '').trim();
  const title = city ? ensureSeoBlogTitle(String(blog.title || ''), city) : String(blog.title || '');
  const coverKey = String(seo.ai_cover_key || '');
  const cover = DAILY_BLOG_COVERS.find((c) => c.key === coverKey) || batchCoverByIndex(offset);
  const uploaded = await uploadDailyCoverWebp({
    supabaseAdmin,
    slug: blog.slug,
    coverFile: cover.file,
    title,
  });

  await supabaseAdmin
    .from('blogs')
    .update({
      title,
      featured_image: uploaded.url,
      seo_data: {
        ...seo,
        meta_title: ensureSeoBlogTitle(String(seo.meta_title || title), city).slice(0, 120),
        og_title: ensureSeoBlogTitle(String(seo.og_title || title), city).slice(0, 120),
        og_image: uploaded.url,
        featured_image_alt: `${title} — MyFNG car service`.slice(0, 125),
        ai_cover_key: cover.key,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', blog.id);

  return {
    success: true,
    blog_id: blog.id,
    slug: blog.slug,
    title,
    cover_key: cover.key,
    offset,
    remaining: remaining.length,
  };
}
