import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { dailyCityScheduleLabel, pickDailyCity } from '@/lib/blog/dailyCities';
import { DAILY_BLOG_COVERS, pickDailyCover, uploadDailyCoverWebp } from '@/lib/blog/dailyCovers';
import {
  dayOfYearIst,
  istDateString,
  nextTenAmIstIso,
  pickDailyTopic,
} from '@/lib/blog/dailyTopics';
import {
  dailyUspScheduleLabel,
  isWeeklyUspDay,
  pickWeeklyUspTopic,
} from '@/lib/blog/dailyUspTopics';
import { publishAiServiceBlog, type DailyBlogRunResult, type DailyBlogSettings } from '@/lib/blog/publishAiServiceBlog';

export type { DailyBlogRunResult, DailyBlogSettings };

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

  const settings = (data as DailyBlogSettings) || null;
  if (settings && Number(settings.word_count) === 900) {
    settings.word_count = 600;
    await supabaseAdmin
      .from('daily_blog_settings')
      .update({ word_count: 600, updated_at: new Date().toISOString() })
      .eq('id', 1);
  }

  return { settings };
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

  const uspDay = isWeeklyUspDay();
  const usp = uspDay ? pickWeeklyUspTopic() : null;
  const picked = usp
    ? { topic: usp.topic, focusKeyword: usp.focusKeyword, intent: usp.intent }
    : pickDailyTopic(day, usedKeywords);
  const cover = pickDailyCover(day);
  const cityTarget = pickDailyCity();

  try {
    const published = await publishAiServiceBlog({
      supabaseAdmin,
      settings,
      picked,
      cityTarget,
      cover,
      runDate,
      usp,
    });

    await writeRun(supabaseAdmin, {
      run_date: runDate,
      blog_id: published.blog_id || null,
      topic: picked.topic,
      cover_key: cover.key,
      status: 'success',
    });

    return published;
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

export async function refreshDailyBlogCover(opts?: { slug?: string }) {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) return { success: false as const, error: adminError || 'Admin client missing' };

  let query = supabaseAdmin
    .from('blogs')
    .select('id, slug, title, seo_data, featured_image')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (opts?.slug) query = query.eq('slug', opts.slug);
  else query = query.contains('seo_data', { ai_daily_post: true });

  const { data: blog, error } = await query.limit(1).maybeSingle();
  if (error || !blog?.id) return { success: false as const, error: error?.message || 'Daily blog not found' };

  const seo = (blog.seo_data || {}) as Record<string, unknown>;
  const coverKey = String(seo.ai_cover_key || seo.cover_key || '');
  const cover = DAILY_BLOG_COVERS.find((c) => c.key === coverKey) || DAILY_BLOG_COVERS[0];
  const uploaded = await uploadDailyCoverWebp({
    supabaseAdmin,
    slug: blog.slug,
    coverFile: cover.file,
    title: String(blog.title || ''),
  });

  await supabaseAdmin
    .from('blogs')
    .update({
      featured_image: uploaded.url,
      seo_data: {
        ...seo,
        og_image: uploaded.url,
        featured_image_alt: `${blog.title} — MyFNG car service`.slice(0, 125),
        ai_cover_key: cover.key,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', blog.id);

  return { success: true as const, slug: blog.slug, title: blog.title, url: uploaded.url };
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
    city: settings?.city || 'Thane',
    city_rotation: dailyCityScheduleLabel(),
    usp_rotation: dailyUspScheduleLabel(),
  };
}
