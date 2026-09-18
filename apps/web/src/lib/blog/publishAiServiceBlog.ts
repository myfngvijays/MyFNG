import { createNotification } from '@/lib/notifications';
import { normalizeBlogContent } from '@/lib/blog/normalizeBlogContent';
import { computeReadTimeFromHtml, validateAllImgHaveAlt } from '@/lib/blog/text';
import { autoFillSeoFromSummary } from '@/lib/blog/seo';
import { normalizeBlogSeoData } from '@/lib/blog/normalizeBlogMedia';
import { revalidateBlogSeo } from '@/lib/seo/revalidate';
import { enrichAiGeneratedHtml } from '@/lib/blog/aiLinks';
import { ensureBlogAppDownloadLink } from '@/lib/blog/blogAppDownload';
import { uploadDailyCoverWebp } from '@/lib/blog/dailyCovers';
import type { DailyTargetCity } from '@/lib/blog/dailyCities';
import type { DailyBlogTopic } from '@/lib/blog/dailyTopics';
import { USP_BLOG_FACTS } from '@/lib/blog/dailyUspTopics';
import { RSA_BLOG_FACTS } from '@/lib/blog/rsaBlogTopics';
import { PACKAGE_EDUCATION_FACTS } from '@/lib/blog/packageEducationBlogTopics';
import type { WeeklyUspTopic } from '@/lib/blog/dailyUspTopics';
import {
  generateAiBlogDraft,
  generateAiFaqs,
  generateAiTagNames,
  toBlogSlug,
} from '@/lib/blog/generateAiDraft';
import { isMyFngServiceFaq } from '@/lib/blog/newsCarBlog';
import { PUBLIC_BLOG_AUTHOR } from '@/lib/blog/publicAuthor';

export type DailyBlogSettings = {
  id: number;
  enabled: boolean;
  city: string;
  tone: string;
  word_count: number;
  category_id: string | null;
  author_id: string | null;
  posts_per_day?: number | null;
  post_times?: string[] | unknown;
  last_run_at: string | null;
  last_blog_id: string | null;
  last_status: string | null;
  last_error: string | null;
  updated_at: string | null;
};

export type DailyBlogRunResult = {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  blog_id?: string;
  slug?: string;
  title?: string;
  topic?: string;
  cover_key?: string;
  run_date?: string;
  error?: string;
};

export type DailyCoverPick = { key: string; file: string };

async function resolveAuthorId(supabaseAdmin: any, preferred: string | null): Promise<{
  id: string | null;
  name: string;
}> {
  const pick = async (userId: string | null) => {
    if (!userId) return { id: null, name: PUBLIC_BLOG_AUTHOR };
    const { data } = await supabaseAdmin
      .from('users_login')
      .select('id, full_name, email')
      .eq('id', userId)
      .maybeSingle();
    return { id: String(data?.id || userId), name: PUBLIC_BLOG_AUTHOR };
  };

  if (preferred) return pick(preferred);

  const { data: namedAuthor } = await supabaseAdmin
    .from('users_login')
    .select('id, full_name, email')
    .ilike('full_name', '%Nikhil%Yelligetti%')
    .limit(1)
    .maybeSingle();
  if (namedAuthor?.id) return pick(namedAuthor.id);

  const { data: roles } = await supabaseAdmin
    .from('roles')
    .select('id, role_code')
    .in('role_code', ['DIGITAL_AUTHOR', 'DIGITAL_MARKETING', 'SUPER_ADMIN']);

  const preferredCodes = ['DIGITAL_AUTHOR', 'DIGITAL_MARKETING', 'SUPER_ADMIN'];
  const roleIds = preferredCodes
    .map((code) => (roles || []).find((r: any) => r.role_code === code)?.id)
    .filter(Boolean);

  for (const roleId of roleIds) {
    const { data: user } = await supabaseAdmin
      .from('users_login')
      .select('id, full_name, email')
      .eq('role_id', roleId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (user?.id) return pick(user.id);
  }

  return { id: null, name: PUBLIC_BLOG_AUTHOR };
}

async function resolveCategoryId(
  supabaseAdmin: any,
  preferred: string | null,
  kind: 'service' | 'usp' | 'rsa' = 'service',
): Promise<string | null> {
  if (kind === 'rsa') {
    const { data: rsaRows } = await supabaseAdmin
      .from('blog_categories')
      .select('id, name')
      .or('name.ilike.%roadside%,name.ilike.%rsa%,name.ilike.%assistance%')
      .limit(5);
    const rsa =
      (rsaRows || []).find((c: any) => /roadside|rsa/i.test(String(c.name || ''))) || rsaRows?.[0];
    if (rsa?.id) return rsa.id;
  }

  if (kind === 'usp') {
    const { data: aboutRows } = await supabaseAdmin
      .from('blog_categories')
      .select('id, name')
      .or('name.ilike.%about%,name.ilike.%myfng%')
      .limit(5);
    const about = (aboutRows || []).find((c: any) => /about/i.test(String(c.name || ''))) || aboutRows?.[0];
    if (about?.id) return about.id;
  }

  if (preferred) return preferred;

  const { data: named } = await supabaseAdmin
    .from('blog_categories')
    .select('id, name')
    .ilike('name', '%service%')
    .limit(1)
    .maybeSingle();
  if (named?.id) return named.id;

  const { data: first } = await supabaseAdmin
    .from('blog_categories')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return first?.id || null;
}

async function uniqueSlug(supabaseAdmin: any, base: string, runDate: string): Promise<string> {
  const compact = runDate.replace(/-/g, '');
  let slug = base || `daily-car-service-${compact}`;
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? slug : `${base}-${compact}${i > 1 ? `-${i}` : ''}`;
    const { data } = await supabaseAdmin.from('blogs').select('id').eq('slug', candidate).maybeSingle();
    if (!data?.id) return candidate;
  }
  return `${base}-${compact}-${Date.now().toString(36)}`;
}

async function ensureTagIds(supabaseAdmin: any, names: string[]): Promise<string[]> {
  const slugs = names.map((n) => toBlogSlug(n)).filter(Boolean);
  if (!slugs.length) return [];

  const { data: existing } = await supabaseAdmin.from('blog_tags').select('id, slug').in('slug', slugs);
  const have = new Set((existing || []).map((t: any) => t.slug));
  const toCreate = names
    .map((name) => ({ name, slug: toBlogSlug(name) }))
    .filter((t) => t.slug && !have.has(t.slug));

  if (toCreate.length) {
    await supabaseAdmin.from('blog_tags').insert(toCreate);
  }

  const { data: all } = await supabaseAdmin.from('blog_tags').select('id, slug').in('slug', slugs);
  return (all || [])
    .sort((a: any, b: any) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug))
    .map((t: any) => t.id);
}

export async function publishAiServiceBlog(opts: {
  supabaseAdmin: any;
  settings: DailyBlogSettings;
  picked: DailyBlogTopic;
  cityTarget: DailyTargetCity;
  cover: DailyCoverPick;
  runDate: string;
  usp?: WeeklyUspTopic | null;
  seoExtra?: Record<string, unknown>;
  notify?: boolean;
}): Promise<DailyBlogRunResult> {
  const { supabaseAdmin, settings, picked, cityTarget, cover, runDate } = opts;
  const usp = opts.usp || null;
  const topic = usp
    ? `${picked.topic} — About MyFNG for car owners in ${cityTarget.name}`
    : `${picked.topic} for car owners in ${cityTarget.name}`;
  const focusKeyword = `${picked.focusKeyword} ${cityTarget.name}`;

  const newsCar = Boolean(opts.seoExtra?.ai_news_car);
  const rsaPost = Boolean(opts.seoExtra?.ai_rsa_post);
  const packagePost = Boolean(opts.seoExtra?.ai_package_post);
  const draft = await generateAiBlogDraft({
    supabase: supabaseAdmin,
    topic,
    focusKeyword,
    city: cityTarget.name,
    localAreas: cityTarget.areas,
    localKeywords: cityTarget.keywords,
    intent: picked.intent,
    tone: settings.tone || 'Professional',
    wordCount: settings.word_count === 900 ? 600 : settings.word_count || 600,
    postKind: newsCar ? 'news' : usp ? 'usp' : rsaPost ? 'rsa' : packagePost ? 'package' : 'service',
    uspFacts: usp ? USP_BLOG_FACTS : undefined,
    aioFacts: newsCar
      ? undefined
      : packagePost
        ? PACKAGE_EDUCATION_FACTS
        : rsaPost
          ? RSA_BLOG_FACTS
          : USP_BLOG_FACTS,
  });

  const slug = await uniqueSlug(supabaseAdmin, draft.slug || toBlogSlug(draft.title), runDate);
  const appLink = await ensureBlogAppDownloadLink({
    supabaseAdmin,
    slug,
    title: draft.title,
    focusKeyword: picked.focusKeyword,
  });
  const withAppCta = enrichAiGeneratedHtml({
    html: draft.content_html,
    slug,
    city: cityTarget.name,
    focusKeyword,
    excerpt: draft.excerpt,
    localAreas: cityTarget.areas,
    localKeywords: cityTarget.keywords,
    appDownloadUrl: appLink.url,
    informativeOnly: newsCar,
  });
  const content = normalizeBlogContent(withAppCta.html);
  const altCheck = validateAllImgHaveAlt(content, 125);
  if (!altCheck.ok) throw new Error(altCheck.error);

  const faqs = (await generateAiFaqs({
    title: draft.title,
    content,
    focusKeyword,
  }).catch(() => [])).filter((f) => !newsCar || !isMyFngServiceFaq(f.question, f.answer));

  const tagNames = await generateAiTagNames({
    title: draft.title,
    content,
    focusKeyword,
  }).catch(() =>
    usp
      ? ['MyFNG', 'About MyFNG', usp.usp, 'Pickup and Drop', `${cityTarget.name} Garage`]
      : rsaPost
        ? ['Roadside Assistance', 'Car Towing', 'MyFNG', `${cityTarget.name} RSA`, 'Jumpstart']
        : ['Car Service', 'Car Maintenance', 'MyFNG', `${cityTarget.name} Garage`, 'Pickup and Drop'],
  );

  const uploaded = await uploadDailyCoverWebp({
    supabaseAdmin,
    slug,
    coverFile: cover.file,
    title: draft.title,
  });

  const author = await resolveAuthorId(supabaseAdmin, settings.author_id);
  const authorId = author.id;
  const categoryId = await resolveCategoryId(
    supabaseAdmin,
    settings.category_id,
    usp ? 'usp' : rsaPost ? 'rsa' : 'service',
  );
  const { minutes } = computeReadTimeFromHtml(content);
  const featuredAlt = `${draft.title} — MyFNG ${rsaPost ? 'roadside assistance' : 'car service'}`.slice(0, 125);

  let seoData = autoFillSeoFromSummary(draft.excerpt, {
    ...draft.seo,
    author_name: PUBLIC_BLOG_AUTHOR,
    featured_image_alt: featuredAlt,
    og_image: uploaded.url,
    search_intent: picked.intent,
    schema_blogposting: true,
    schema_faq: faqs.length >= 5,
    eligible_ai_overview: true,
    ai_generated: true,
    ai_daily_post: true,
    ai_usp_post: Boolean(usp),
    ai_usp_key: usp?.key || null,
    ai_cover_key: cover.key,
    ai_topic: picked.topic,
    ai_focus_keyword: focusKeyword,
    ai_city: cityTarget.name,
    local_city: cityTarget.name,
    local_areas: cityTarget.areas,
    local_keywords: cityTarget.keywords,
    local_areas_resolved: cityTarget.areas,
    cta_text: 'Download MyFNG App',
    cta_url: appLink.url,
    app_download_url: appLink.url,
    related_articles: draft.seo.related_articles || [],
    ...(opts.seoExtra || {}),
    author_name: PUBLIC_BLOG_AUTHOR,
  });
  seoData = normalizeBlogSeoData({
    ...seoData,
    author_name: PUBLIC_BLOG_AUTHOR,
  });

  const now = new Date().toISOString();
  const { data: blog, error: insertError } = await supabaseAdmin
    .from('blogs')
    .insert({
      title: draft.title,
      slug,
      excerpt: draft.excerpt,
      content,
      seo_data: seoData,
      category_id: categoryId,
      author_id: authorId,
      created_by: authorId,
      updated_by: authorId,
      read_time: minutes || draft.read_time || 5,
      featured_image: uploaded.url,
      status: 'published',
      is_featured: false,
      is_premium: false,
      published_at: now,
    })
    .select('id, title, slug')
    .single();

  if (insertError || !blog?.id) {
    throw new Error(insertError?.message || 'Failed to insert blog');
  }

  if (categoryId) {
    await supabaseAdmin.from('blog_category_mapping').insert({
      blog_id: blog.id,
      category_id: categoryId,
      is_primary: true,
    }).then(() => undefined, () => undefined);
  }

  const tagIds = await ensureTagIds(supabaseAdmin, tagNames).catch(() => [] as string[]);
  if (tagIds.length) {
    await supabaseAdmin.from('blog_tag_mapping').insert(
      tagIds.map((tag_id) => ({ blog_id: blog.id, tag_id })),
    ).then(() => undefined, () => undefined);
  }

  if (faqs.length) {
    await supabaseAdmin.from('blog_faqs').insert(
      faqs.map((f, idx) => ({
        blog_id: blog.id,
        question: f.question,
        answer: f.answer,
        sort_order: idx,
      })),
    ).then(() => undefined, () => undefined);
  }

  revalidateBlogSeo(slug);

  if (opts.notify !== false && authorId) {
    try {
      await createNotification({
        userId: authorId,
        type: 'SYSTEM_ALERT',
        title: usp ? 'Weekly MyFNG USP blog published' : 'Daily blog published',
        message: `"${blog.title}" is live on the daily auto-post schedule.`,
        priority: 'HIGH',
        actionUrl: `/dashboard/digital_marketing/blogs/${blog.id}/edit`,
        metadata: { blog_id: blog.id, status: 'published', ai_daily_post: true },
      });
    } catch {
      // non-blocking
    }
  }

  return {
    success: true,
    blog_id: blog.id,
    slug,
    title: blog.title,
    topic: picked.topic,
    cover_key: cover.key,
    run_date: runDate,
  };
}
