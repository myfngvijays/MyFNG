import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { dailyCityScheduleLabel, pickDailyCity } from '@/lib/blog/dailyCities';
import { DAILY_BLOG_COVERS, pickDailyCover, uploadDailyCoverWebp } from '@/lib/blog/dailyCovers';
import {
  dayOfYearIst,
  istDateString,
  pickDailyTopic,
} from '@/lib/blog/dailyTopics';
import {
  dailyUspScheduleLabel,
  isWeeklyUspDay,
  pickWeeklyUspTopic,
} from '@/lib/blog/dailyUspTopics';
import { publishAiServiceBlog, type DailyBlogRunResult, type DailyBlogSettings } from '@/lib/blog/publishAiServiceBlog';
import { ensureSeoBlogTitle } from '@/lib/blog/generateAiDraft';
import { firstDueSlot, nextDailySlotIso, overdueSlotIndexes, resolveDailyBlogSchedule } from '@/lib/blog/dailyBlogSlots';
import { logDailyBlogEvent, type DailyBlogLogSource } from '@/lib/blog/dailyBlogLog';

export type { DailyBlogRunResult, DailyBlogSettings };

function missingTable(error: { message?: string } | null | undefined) {
  return /does not exist|relation|42P01|PGRST205/i.test(String(error?.message || ''));
}

const LOCK_STALE_MS = 8 * 60 * 1000;

async function claimDailyBlogLock(supabaseAdmin: any): Promise<boolean> {
  const now = new Date().toISOString();
  const staleIso = new Date(Date.now() - LOCK_STALE_MS).toISOString();
  const claimed = await supabaseAdmin
    .from('daily_blog_settings')
    .update({
      last_run_at: now,
      last_status: 'running',
      last_error: null,
      updated_at: now,
    })
    .eq('id', 1)
    .or(`last_status.is.null,last_status.neq.running,last_run_at.is.null,last_run_at.lt.${staleIso}`)
    .select('id')
    .maybeSingle();
  return Boolean(claimed.data?.id) && !claimed.error;
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
    slot_index?: number;
    blog_id?: string | null;
    topic?: string | null;
    cover_key?: string | null;
    status: 'success' | 'skipped' | 'failed';
    error?: string | null;
  },
) {
  const payload = {
    run_date: row.run_date,
    slot_index: row.slot_index || 1,
    blog_id: row.blog_id || null,
    topic: row.topic || null,
    cover_key: row.cover_key || null,
    status: row.status,
    error: row.error || null,
  };
  const slotted = await supabaseAdmin.from('daily_blog_runs').upsert(payload, { onConflict: 'run_date,slot_index' });
  if (slotted.error) {
    await supabaseAdmin.from('daily_blog_runs').upsert(
      {
        run_date: payload.run_date,
        blog_id: payload.blog_id,
        topic: payload.topic,
        cover_key: payload.cover_key,
        status: payload.status,
        error: payload.error,
      },
      { onConflict: 'run_date' },
    );
  }

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

async function repairBrokenCityTitles(supabaseAdmin: any) {
  const { data } = await supabaseAdmin
    .from('blogs')
    .select('id, slug, title, seo_data')
    .or('title.ilike.% for in %,title.ilike.% at in %,title.ilike.% near in %,title.ilike.% in :%,slug.ilike.%-for-in-%')
    .limit(30);
  for (const row of data || []) {
    const seo = (row.seo_data || {}) as Record<string, unknown>;
    const city = String(seo.local_city || seo.ai_city || '').trim();
    if (!city) continue;
    const title = ensureSeoBlogTitle(String(row.title || ''), city);
    if (!title || title === row.title) {
      if (row.slug && /-for-in-/.test(String(row.slug))) {
        await refreshDailyBlogCover({ slug: String(row.slug) }).catch(() => undefined);
      }
      continue;
    }
    await supabaseAdmin
      .from('blogs')
      .update({
        title,
        seo_data: {
          ...seo,
          meta_title: ensureSeoBlogTitle(String(seo.meta_title || title), city).slice(0, 120),
          og_title: ensureSeoBlogTitle(String(seo.og_title || title), city).slice(0, 120),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (row.slug) {
      await refreshDailyBlogCover({ slug: String(row.slug) }).catch(() => undefined);
    }
  }
}

export async function maybeCatchUpDailyBlog(opts?: {
  source?: DailyBlogLogSource;
}): Promise<DailyBlogRunResult | { skipped: true; reason: string }> {
  const source = opts?.source || 'cart_catchup';
  const loaded = await loadDailyBlogSettings();
  if (loaded.missing || !loaded.settings) {
    return { skipped: true, reason: 'settings_missing' };
  }
  const settings = loaded.settings;
  if (!settings.enabled) return { skipped: true, reason: 'disabled' };

  const lastStatus = String(settings.last_status || '');
  const lastRunMs = settings.last_run_at ? Date.parse(settings.last_run_at) : 0;
  if (lastStatus === 'running' && lastRunMs && Date.now() - lastRunMs < LOCK_STALE_MS) {
    return { skipped: true, reason: 'already_running' };
  }
  if (lastStatus === 'running' && lastRunMs && Date.now() - lastRunMs >= LOCK_STALE_MS) {
    await logDailyBlogEvent({
      source,
      action: 'stale_running_reset',
      status: 'info',
      reason: 'stale_running_reset',
      details: { last_run_at: settings.last_run_at },
    });
  }

  const schedule = resolveDailyBlogSchedule(settings);
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { skipped: true, reason: 'admin_missing' };

  const runDate = istDateString();
  let runsRes = await supabaseAdmin
    .from('daily_blog_runs')
    .select('status, slot_index')
    .eq('run_date', runDate);
  if (runsRes.error) {
    runsRes = await supabaseAdmin.from('daily_blog_runs').select('status').eq('run_date', runDate);
  }
  const postedIndexes = (runsRes.data || [])
    .filter((row: any) => row.status === 'success')
    .map((row: any, idx: number) => Number(row.slot_index || idx + 1));
  const overdue = overdueSlotIndexes(schedule, postedIndexes);
  if (!overdue.length) return { skipped: true, reason: 'no_overdue_slot' };

  return runDailyBlogPost({ source });
}

export async function runDailyBlogPost(opts?: {
  force?: boolean;
  source?: DailyBlogLogSource;
}): Promise<DailyBlogRunResult> {
  const force = Boolean(opts?.force);
  const source = opts?.source || 'cron';
  const started = Date.now();
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    const error = adminError || 'Admin client not configured';
    await logDailyBlogEvent({
      source,
      action: 'failed',
      status: 'failed',
      error,
      duration_ms: Date.now() - started,
    });
    return { success: false, error };
  }
  await repairBrokenCityTitles(supabaseAdmin).catch(() => undefined);

  const loaded = await loadDailyBlogSettings();
  if (loaded.missing) {
    const error = 'Migration 365_daily_blog_auto_post.sql is not applied';
    await logDailyBlogEvent({
      source,
      action: 'failed',
      status: 'failed',
      error,
      duration_ms: Date.now() - started,
    });
    return { success: false, error };
  }
  if (!loaded.settings) {
    const error = loaded.error || 'Daily blog settings missing';
    await logDailyBlogEvent({
      source,
      action: 'failed',
      status: 'failed',
      error,
      duration_ms: Date.now() - started,
    });
    return { success: false, error };
  }

  const settings = loaded.settings;
  const runDate = istDateString();
  const day = dayOfYearIst();

  if (!settings.enabled && !force) {
    await logDailyBlogEvent({
      source,
      action: 'skipped',
      status: 'skipped',
      reason: 'disabled',
      run_date: runDate,
      duration_ms: Date.now() - started,
    });
    return { success: true, skipped: true, reason: 'disabled', run_date: runDate };
  }

  const schedule = resolveDailyBlogSchedule(settings);
  let todayQuery = await supabaseAdmin
    .from('daily_blog_runs')
    .select('id, status, blog_id, slot_index, topic')
    .eq('run_date', runDate);
  if (todayQuery.error) {
    todayQuery = await supabaseAdmin
      .from('daily_blog_runs')
      .select('id, status, blog_id, topic')
      .eq('run_date', runDate);
  }
  const todayRuns = todayQuery.data;
  const postedIndexes = (todayRuns || [])
    .filter((row: any) => row.status === 'success')
    .map((row: any, idx: number) => Number(row.slot_index || idx + 1));

  const { data: recentPublished } = await supabaseAdmin
    .from('blogs')
    .select('id, slug, title, published_at, seo_data')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(30);
  const liveToday = (recentPublished || []).filter((row: any) => {
    const seo = row?.seo_data || {};
    if (!seo.ai_daily_post || seo.ai_batch_post) return false;
    if (!row?.published_at) return false;
    return istDateString(new Date(row.published_at)) === runDate;
  });
  if (postedIndexes.length < liveToday.length) {
    liveToday.forEach((row: any, idx: number) => {
      const slot = idx + 1;
      if (!postedIndexes.includes(slot)) postedIndexes.push(slot);
    });
  }

  const due = firstDueSlot(schedule, postedIndexes, new Date(), force);
  if (!due) {
    const done = postedIndexes.length >= schedule.posts_per_day;
    const reason = done ? 'already_posted_today' : 'waiting_for_next_slot';
    await logDailyBlogEvent({
      source,
      action: 'skipped',
      status: 'skipped',
      reason,
      run_date: runDate,
      duration_ms: Date.now() - started,
      details: { posted_indexes: postedIndexes, posts_per_day: schedule.posts_per_day, times: schedule.times },
    });
    return {
      success: true,
      skipped: true,
      reason,
      blog_id: (todayRuns || []).find((row: any) => row.status === 'success')?.blog_id || liveToday[0]?.id,
      run_date: runDate,
    };
  }

  if (!force && postedIndexes.includes(due.index)) {
    await logDailyBlogEvent({
      source,
      action: 'skipped',
      status: 'skipped',
      reason: 'already_posted_today',
      slot_index: due.index,
      run_date: runDate,
      duration_ms: Date.now() - started,
    });
    return { success: true, skipped: true, reason: 'already_posted_today', run_date: runDate };
  }

  const locked = await claimDailyBlogLock(supabaseAdmin);
  if (!locked) {
    await logDailyBlogEvent({
      source,
      action: 'skipped',
      status: 'skipped',
      reason: 'already_running',
      slot_index: due.index,
      run_date: runDate,
      duration_ms: Date.now() - started,
    });
    return { success: true, skipped: true, reason: 'already_running', run_date: runDate };
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

  const uspDay = isWeeklyUspDay() && due.index === 1;
  const usp = uspDay ? pickWeeklyUspTopic() : null;
  const picked = usp
    ? { topic: usp.topic, focusKeyword: usp.focusKeyword, intent: usp.intent }
    : pickDailyTopic(day + (due.index - 1) * 17, usedKeywords);
  const cover = pickDailyCover(day + (due.index - 1) * 5);
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
      slot_index: due.index,
      blog_id: published.blog_id || null,
      topic: picked.topic,
      cover_key: cover.key,
      status: 'success',
    });
    await logDailyBlogEvent({
      source,
      action: 'posted',
      status: 'success',
      slot_index: due.index,
      run_date: runDate,
      topic: picked.topic,
      blog_id: published.blog_id || null,
      blog_title: published.title || null,
      duration_ms: Date.now() - started,
      details: { slug: published.slug || null, cover_key: cover.key, force },
    });

    return published;
  } catch (error: any) {
    const message = String(error?.message || error || 'Daily blog failed');
    await writeRun(supabaseAdmin, {
      run_date: runDate,
      slot_index: due.index,
      topic: picked.topic,
      cover_key: cover.key,
      status: 'failed',
      error: message.slice(0, 500),
    });
    await logDailyBlogEvent({
      source,
      action: 'failed',
      status: 'failed',
      slot_index: due.index,
      run_date: runDate,
      topic: picked.topic,
      error: message,
      duration_ms: Date.now() - started,
      details: { cover_key: cover.key, force },
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

export function dailyBlogScheduleInfo(settings: DailyBlogSettings | null, postedIndexes: number[] = []) {
  const resolved = resolveDailyBlogSchedule(settings);
  return {
    schedule: resolved.label,
    cron: '30 * * * *',
    provider: 'Supabase Cronon → /api/cron/daily-blog',
    next_run_at: nextDailySlotIso(resolved, new Date(), postedIndexes),
    enabled: Boolean(settings?.enabled),
    posts_per_day: resolved.posts_per_day,
    post_times: resolved.times,
    slots: resolved.slots,
    last_run_at: settings?.last_run_at || null,
    last_status: settings?.last_status || null,
    last_error: settings?.last_error || null,
    last_blog_id: settings?.last_blog_id || null,
    city: settings?.city || 'Thane',
    city_rotation: dailyCityScheduleLabel(),
    usp_rotation: dailyUspScheduleLabel(),
  };
}
