import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createNotification } from '@/lib/notifications';
import { normalizeBlogContent } from '@/lib/blog/normalizeBlogContent';
import { computeReadTimeFromHtml, validateAllImgHaveAlt } from '@/lib/blog/text';
import { autoFillSeoFromSummary } from '@/lib/blog/seo';
import { normalizeBlogSeoData } from '@/lib/blog/normalizeBlogMedia';
import { revalidateBlogSeo } from '@/lib/seo/revalidate';
import { pickDailyCover, uploadDailyCoverWebp } from '@/lib/blog/dailyCovers';
import {
  dayOfYearIst,
  istDateString,
  nextTenAmIstIso,
  pickDailyTopic,
} from '@/lib/blog/dailyTopics';
import {
  generateAiBlogDraft,
  generateAiFaqs,
  generateAiTagNames,
  toBlogSlug,
} from '@/lib/blog/generateAiDraft';

export type DailyBlogSettings = {
  id: number;
  enabled: boolean;
  city: string;
  tone: string;
  word_count: number;
  category_id: string | null;
  author_id: string | null;
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

function missingTable(error: { message?: string } | null | undefined) {
  return /does not exist|relation|42P01|PGRST205/i.test(String(error?.message || ''));
}

export async function loadDailyBlogSettings(): Promise<{
  settings: DailyBlogSettings | null;
  error?: string;
  missing?: boolean;
}> {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { settings: null, error: adminError || 'Admin client not configured' };
  }

  const { data, error } = await supabaseAdmin
    .from('daily_blog_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    return {
      settings: null,
      error: error.message,
      missing: missingTable(error),
    };
  }

  return { settings: (data as DailyBlogSettings) || null };
}

async function resolveAuthorId(supabaseAdmin: any, preferred: string | null): Promise<string | null> {
  if (preferred) return preferred;

  const { data: roles } = await supabaseAdmin
    .from('roles')
    .select('id, role_code')
    .in('role_code', ['DIGITAL_MARKETING', 'SUPER_ADMIN']);

  const roleIds = (roles || []).map((r: any) => r.id).filter(Boolean);
  if (!roleIds.length) return null;

  const { data: user } = await supabaseAdmin
    .from('users_login')
    .select('id')
    .in('role_id', roleIds)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return user?.id || null;
}

async function resolveCategoryId(supabaseAdmin: any, preferred: string | null): Promise<string | null> {
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

async function writeRun(
  supabaseAdmin: any,
  row: {
    run_date: string;
    blog_id?: string | null;
    topic?: string | null;
    cover_key?: string | null;
    status: 'success' | 'skipped' | 'failed';
    error?: string | null;
  },
) {
  await supabaseAdmin.from('daily_blog_runs').upsert(
    {
      run_date: row.run_date,
      blog_id: row.blog_id || null,
      topic: row.topic || null,
      cover_key: row.cover_key || null,
      status: row.status,
      error: row.error || null,
    },
    { onConflict: 'run_date' },
  );

  await supabaseAdmin
    .from('daily_blog_settings')
    .update({
      last_run_at: new Date().toISOString(),
      last_blog_id: row.blog_id || null,
      last_status: row.status,
      last_error: row.error || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
}

export async function runDailyBlogPost(opts?: { force?: boolean }): Promise<DailyBlogRunResult> {
  const force = Boolean(opts?.force);
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { success: false, error: adminError || 'Admin client not configured' };
  }

  const loaded = await loadDailyBlogSettings();
  if (loaded.missing) {
    return { success: false, error: 'Migration 365_daily_blog_auto_post.sql is not applied' };
  }
  if (!loaded.settings) {
    return { success: false, error: loaded.error || 'Daily blog settings missing' };
  }

  const settings = loaded.settings;
  const runDate = istDateString();
  const day = dayOfYearIst();

  if (!settings.enabled && !force) {
    await writeRun(supabaseAdmin, { run_date: runDate, status: 'skipped', error: 'disabled' });
    return { success: true, skipped: true, reason: 'disabled', run_date: runDate };
  }

  if (!force) {
    const { data: existing } = await supabaseAdmin
      .from('daily_blog_runs')
      .select('id, status, blog_id')
      .eq('run_date', runDate)
      .maybeSingle();
    if (existing?.status === 'success') {
      return {
        success: true,
        skipped: true,
        reason: 'already_posted_today',
        blog_id: existing.blog_id || undefined,
        run_date: runDate,
      };
    }
  }

  const { data: recent } = await supabaseAdmin
    .from('blogs')
    .select('title, seo_data')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(40);

  const usedKeywords = (recent || [])
    .map((b: any) => String(b?.seo_data?.ai_focus_keyword || b?.seo_data?.keywords || '').split(',')[0] || '')
    .filter(Boolean);

  const picked = pickDailyTopic(day, usedKeywords);
  const cover = pickDailyCover(day);

  try {
    const draft = await generateAiBlogDraft({
      supabase: supabaseAdmin,
      topic: picked.topic,
      focusKeyword: picked.focusKeyword,
      city: settings.city || 'Pune',
      intent: picked.intent,
      tone: settings.tone || 'Professional',
      wordCount: settings.word_count || 900,
    });

    const content = normalizeBlogContent(draft.content_html);
    const altCheck = validateAllImgHaveAlt(content, 125);
    if (!altCheck.ok) throw new Error(altCheck.error);

    const faqs = await generateAiFaqs({
      title: draft.title,
      content,
      focusKeyword: picked.focusKeyword,
    }).catch(() => []);

    const tagNames = await generateAiTagNames({
      title: draft.title,
      content,
      focusKeyword: picked.focusKeyword,
    }).catch(() => ['Car Service', 'Car Maintenance', 'MyFNG', 'Pune Garage', 'Periodic Service']);

    const slug = await uniqueSlug(supabaseAdmin, draft.slug || toBlogSlug(draft.title), runDate);
    const uploaded = await uploadDailyCoverWebp({
      supabaseAdmin,
      slug,
      coverFile: cover.file,
    });

    const authorId = await resolveAuthorId(supabaseAdmin, settings.author_id);
    const categoryId = await resolveCategoryId(supabaseAdmin, settings.category_id);
    const { minutes } = computeReadTimeFromHtml(content);
    const featuredAlt = `${draft.title} — MyFNG car service`.slice(0, 125);

    let seoData = autoFillSeoFromSummary(draft.excerpt, {
      ...draft.seo,
      featured_image_alt: featuredAlt,
      og_image: uploaded.url,
      search_intent: picked.intent,
      schema_blogposting: true,
      schema_faq: faqs.length >= 5,
      eligible_ai_overview: true,
      ai_generated: true,
      ai_daily_post: true,
      ai_topic: picked.topic,
      ai_focus_keyword: picked.focusKeyword,
      ai_city: settings.city || 'Pune',
      local_city: settings.city || 'Pune',
      cta_text: draft.seo.cta_text || 'Book Service Now',
      cta_url: draft.seo.cta_url || '',
      related_articles: draft.seo.related_articles || [],
    });
    seoData = normalizeBlogSeoData(seoData);

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
      throw new Error(insertError?.message || 'Failed to insert daily blog');
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

    await writeRun(supabaseAdmin, {
      run_date: runDate,
      blog_id: blog.id,
      topic: picked.topic,
      cover_key: cover.key,
      status: 'success',
    });

    revalidateBlogSeo(slug);

    if (authorId) {
      try {
        await createNotification({
          userId: authorId,
          type: 'SYSTEM_ALERT',
          title: 'Daily blog published',
          message: `"${blog.title}" went live at 10:00 AM IST.`,
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
  } catch (error: any) {
    const message = String(error?.message || error || 'Daily blog failed');
    await writeRun(supabaseAdmin, {
      run_date: runDate,
      topic: picked.topic,
      cover_key: cover.key,
      status: 'failed',
      error: message.slice(0, 500),
    });
    return { success: false, error: message, topic: picked.topic, cover_key: cover.key, run_date: runDate };
  }
}

export function dailyBlogScheduleInfo(settings: DailyBlogSettings | null) {
  return {
    schedule: '10:00 AM IST',
    cron: '30 4 * * *',
    next_run_at: nextTenAmIstIso(),
    enabled: Boolean(settings?.enabled),
    last_run_at: settings?.last_run_at || null,
    last_status: settings?.last_status || null,
    last_error: settings?.last_error || null,
    last_blog_id: settings?.last_blog_id || null,
    city: settings?.city || 'Pune',
  };
}
