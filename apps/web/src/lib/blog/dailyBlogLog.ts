import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { istDateDaysAgo, istDateString } from '@/lib/blog/dailyTopics';
import { dueSlotIndexes, istMinutesNow, resolveDailyBlogSchedule, slotIsoForRunDate } from '@/lib/blog/dailyBlogSlots';
import type { DailyBlogSettings } from '@/lib/blog/publishAiServiceBlog';

export type DailyBlogLogSource =
  | 'cron'
  | 'cart_catchup'
  | 'admin_run_now'
  | 'admin_page_catchup'
  | 'admin_settings';

export type DailyBlogLogStatus = 'success' | 'skipped' | 'failed' | 'info';

export type DailyBlogLogEntry = {
  id?: string;
  created_at?: string;
  source: DailyBlogLogSource | string;
  action: string;
  status: DailyBlogLogStatus | string;
  reason?: string | null;
  slot_index?: number | null;
  run_date?: string | null;
  topic?: string | null;
  blog_id?: string | null;
  blog_title?: string | null;
  error?: string | null;
  duration_ms?: number | null;
  details?: Record<string, unknown> | null;
};

const SKIP_NOISE = new Set([
  'no_overdue_slot',
  'already_running',
  'already_posted_today',
  'waiting_for_next_slot',
]);

let logsTableMissing = false;

function missingTable(error: { message?: string } | null | undefined) {
  return /does not exist|relation|42P01|PGRST205/i.test(String(error?.message || ''));
}

function shouldSkipNoise(entry: DailyBlogLogEntry) {
  const reason = String(entry.reason || '');
  if (entry.source === 'cron') return false;
  if (entry.source === 'admin_run_now' || entry.source === 'admin_settings') return false;
  return SKIP_NOISE.has(reason);
}

export async function logDailyBlogEvent(entry: DailyBlogLogEntry): Promise<void> {
  if (logsTableMissing) return;
  if (shouldSkipNoise(entry)) return;

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  const { error } = await supabaseAdmin.from('daily_blog_cron_logs').insert({
    source: entry.source,
    action: entry.action,
    status: entry.status,
    reason: entry.reason || null,
    slot_index: entry.slot_index || null,
    run_date: entry.run_date || istDateString(),
    topic: entry.topic || null,
    blog_id: entry.blog_id || null,
    blog_title: entry.blog_title || null,
    error: entry.error ? String(entry.error).slice(0, 800) : null,
    duration_ms: entry.duration_ms ?? null,
    details: entry.details || null,
  });

  if (error && missingTable(error)) {
    logsTableMissing = true;
    return;
  }

  if (Math.random() < 0.04) {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin.from('daily_blog_cron_logs').delete().lt('created_at', cutoff);
  }
}

export function istDateFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function dailyBlogAssignedDate(
  row: { id?: string; published_at?: string | null; seo_data?: any },
  runByBlogId?: Map<string, string>,
): string | null {
  const id = String(row?.id || '');
  const fromRun = id ? runByBlogId?.get(id) : undefined;
  if (fromRun && /^\d{4}-\d{2}-\d{2}$/.test(fromRun)) return fromRun;
  const seo = row?.seo_data || {};
  const fromSeo = String(seo.ai_run_date || seo.run_date || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromSeo)) return fromSeo;
  return istDateFromIso(row?.published_at);
}

export async function alignDailyBlogAttribution(
  supabaseAdmin: any,
  settings?: DailyBlogSettings | null,
): Promise<number> {
  if (!supabaseAdmin) return 0;
  const schedule = resolveDailyBlogSchedule(settings);
  const since = istDateDaysAgo(14);
  let runsRes = await supabaseAdmin
    .from('daily_blog_runs')
    .select('run_date, slot_index, blog_id, status, created_at')
    .eq('status', 'success')
    .not('blog_id', 'is', null)
    .gte('run_date', since);
  if (runsRes.error) {
    runsRes = await supabaseAdmin
      .from('daily_blog_runs')
      .select('run_date, blog_id, status, created_at')
      .eq('status', 'success')
      .gte('run_date', since);
  }
  const runs = (runsRes.data || []).filter((row: any) => row?.blog_id && row?.run_date);
  if (!runs.length) return 0;

  const ids = [...new Set(runs.map((row: any) => String(row.blog_id)))];
  const { data: blogs } = await supabaseAdmin
    .from('blogs')
    .select('id, published_at, seo_data')
    .in('id', ids);
  const byId = new Map((blogs || []).map((row: any) => [String(row.id), row]));
  let fixed = 0;
  const firstSlotMin = schedule.slots[0]?.minutes ?? 10 * 60;

  for (const run of runs) {
    const blog = byId.get(String(run.blog_id));
    if (!blog) continue;
    const oldDate = String(run.run_date).slice(0, 10);
    let runDate = oldDate;
    if (run.created_at) {
      const created = new Date(run.created_at);
      const createdIst = istDateFromIso(run.created_at);
      if (!Number.isNaN(created.getTime()) && createdIst === oldDate && istMinutesNow(created) < firstSlotMin) {
        runDate = istDateDaysAgo(1, created);
      }
    }
    const slotIndex = Math.max(1, Number(run.slot_index) || 1);
    const slot = schedule.slots.find((item) => item.index === slotIndex) || schedule.slots[0];
    const publishedAt = slotIsoForRunDate(slot?.time || '10:00', runDate);
    const seo = { ...(blog.seo_data || {}) };
    const sameSeo = String(seo.ai_run_date || '') === runDate && Number(seo.ai_slot_index || 0) === slotIndex;
    const samePub = String(blog.published_at || '').slice(0, 19) === publishedAt.slice(0, 19);
    const sameRun = oldDate === runDate;
    if (sameSeo && samePub && sameRun) continue;

    if (!sameRun) {
      const moved = await supabaseAdmin
        .from('daily_blog_runs')
        .update({ run_date: runDate })
        .eq('blog_id', blog.id)
        .eq('run_date', oldDate);
      if (moved.error) {
        await supabaseAdmin.from('daily_blog_runs').upsert(
          {
            run_date: runDate,
            slot_index: slotIndex,
            blog_id: blog.id,
            status: 'success',
            topic: seo.ai_topic || null,
          },
          { onConflict: 'run_date,slot_index' },
        );
      }
    }

    const { error } = await supabaseAdmin
      .from('blogs')
      .update({
        published_at: publishedAt,
        seo_data: {
          ...seo,
          ai_daily_post: true,
          ai_run_date: runDate,
          ai_slot_index: slotIndex,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', blog.id);
    if (!error) {
      fixed += 1;
      byId.set(String(blog.id), { ...blog, published_at: publishedAt, seo_data: { ...seo, ai_run_date: runDate } });
    }
  }
  return fixed;
}

export function formatLogReason(reason?: string | null) {
  switch (String(reason || '')) {
    case 'waiting_for_next_slot':
      return 'Waiting for next IST slot';
    case 'already_posted_today':
      return 'That IST date already has its live posts';
    case 'disabled':
      return 'Auto-post is paused';
    case 'no_overdue_slot':
      return 'No overdue slot';
    case 'already_running':
      return 'Previous run still in progress';
    case 'settings_missing':
      return 'daily_blog_settings missing';
    case 'admin_missing':
      return 'Admin DB client missing';
    case 'cron_auth_denied':
      return 'Cron request unauthorized (secret mismatch)';
    case 'stale_running_reset':
      return 'Stuck running status was reset';
    default:
      return reason || '—';
  }
}

export type DailyBlogDaySummary = {
  date: string;
  expected: number;
  posted: number;
  failed: number;
  missing: number;
  blogs: Array<{ id: string; title: string; slug: string; published_at: string | null }>;
  runs: Array<{ slot_index: number; status: string; topic?: string | null; error?: string | null }>;
};

export type DailyBlogOpsSnapshot = {
  table_missing: boolean;
  enabled: boolean;
  last_status: string | null;
  last_error: string | null;
  last_run_at: string | null;
  last_success_at: string | null;
  posts_per_day: number;
  post_times: string[];
  schedule_label: string;
  today: string;
  today_posted: number;
  today_due: number;
  days: DailyBlogDaySummary[];
  events: DailyBlogLogEntry[];
  diagnosis: { level: 'ok' | 'warn' | 'error'; title: string; message: string };
};

function addDaysIst(dateStr: string, delta: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d) + delta * 86400000;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(utc));
}

export async function loadDailyBlogOpsSnapshot(opts?: {
  days?: number;
  eventLimit?: number;
  settings?: DailyBlogSettings | null;
}): Promise<DailyBlogOpsSnapshot> {
  const dayCount = Math.max(3, Math.min(14, opts?.days || 7));
  const eventLimit = Math.max(20, Math.min(300, opts?.eventLimit || 80));
  const today = istDateString();
  const schedule = resolveDailyBlogSchedule(opts?.settings);
  const empty: DailyBlogOpsSnapshot = {
    table_missing: false,
    enabled: opts?.settings?.enabled !== false,
    last_status: opts?.settings?.last_status || null,
    last_error: opts?.settings?.last_error || null,
    last_run_at: opts?.settings?.last_run_at || null,
    last_success_at: null,
    posts_per_day: schedule.posts_per_day,
    post_times: schedule.times,
    schedule_label: schedule.label,
    today,
    today_posted: 0,
    today_due: dueSlotIndexes(schedule).length,
    days: [],
    events: [],
    diagnosis: { level: 'warn', title: 'No data', message: 'Could not load daily blog history.' },
  };

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    empty.diagnosis = { level: 'error', title: 'DB unavailable', message: 'Admin client is not configured.' };
    return empty;
  }

  await alignDailyBlogAttribution(supabaseAdmin, opts?.settings).catch(() => 0);

  const since = addDaysIst(today, -(dayCount - 1));
  const sinceIso = `${since}T00:00:00+05:30`;

  const [blogsRes, runsRes, logsRes] = await Promise.all([
    supabaseAdmin
      .from('blogs')
      .select('id, title, slug, published_at, seo_data')
      .eq('status', 'published')
      .gte('published_at', sinceIso)
      .order('published_at', { ascending: false })
      .limit(80),
    supabaseAdmin
      .from('daily_blog_runs')
      .select('run_date, slot_index, status, topic, error, created_at, blog_id')
      .gte('run_date', since)
      .order('run_date', { ascending: false }),
    supabaseAdmin
      .from('daily_blog_cron_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(eventLimit),
  ]);

  const tableMissing = Boolean(logsRes.error && missingTable(logsRes.error));
  if (tableMissing) logsTableMissing = true;

  const dailyBlogs: any[] = (blogsRes.data || []).filter((row: any) => {
    const seo = row?.seo_data || {};
    return Boolean(seo.ai_daily_post) && !seo.ai_batch_post;
  });
  const runByBlogId = new Map<string, string>();
  for (const row of runsRes.data || []) {
    if (row?.blog_id && row?.run_date && String(row.status || '') === 'success') {
      runByBlogId.set(String(row.blog_id), String(row.run_date).slice(0, 10));
    }
  }
  const missingIds = [...runByBlogId.keys()].filter((id) => !dailyBlogs.some((row: any) => String(row.id) === id));
  if (missingIds.length) {
    const extra = await supabaseAdmin
      .from('blogs')
      .select('id, title, slug, published_at, seo_data')
      .in('id', missingIds);
    for (const row of extra.data || []) dailyBlogs.push(row);
  }

  const days: DailyBlogDaySummary[] = [];
  for (let i = 0; i < dayCount; i += 1) {
    const date = addDaysIst(today, -i);
    const blogs = dailyBlogs
      .filter((row: any) => dailyBlogAssignedDate(row, runByBlogId) === date)
      .map((row: any) => ({
        id: String(row.id),
        title: String(row.title || ''),
        slug: String(row.slug || ''),
        published_at: row.published_at || null,
      }));
    const runs = (runsRes.data || [])
      .filter((row: any) => String(row.run_date) === date)
      .map((row: any) => ({
        slot_index: Number(row.slot_index || 1),
        status: String(row.status || ''),
        topic: row.topic || null,
        error: row.error || null,
      }));
    const isToday = date === today;
    const expected = isToday ? dueSlotIndexes(schedule).length : schedule.posts_per_day;
    const posted = blogs.length;
    const failed = runs.filter((row) => row.status === 'failed').length;
    days.push({
      date,
      expected,
      posted,
      failed,
      missing: Math.max(0, expected - posted),
      blogs,
      runs,
    });
  }

  const todayRow = days.find((d) => d.date === today);
  const lastSuccess = dailyBlogs[0]?.published_at || null;
  const events: DailyBlogLogEntry[] = tableMissing
    ? [
        ...dailyBlogs.map((row: any) => ({
          created_at: row.published_at,
          source: 'reconstructed',
          action: 'posted',
          status: 'success' as const,
          run_date: dailyBlogAssignedDate(row, runByBlogId),
          blog_id: row.id,
          blog_title: row.title,
        })),
        ...(runsRes.data || [])
          .filter((row: any) => row.status !== 'success')
          .map((row: any) => ({
            created_at: row.created_at,
            source: 'reconstructed',
            action: row.status,
            status: row.status,
            reason: row.error || row.status,
            slot_index: row.slot_index,
            run_date: row.run_date,
            topic: row.topic,
            error: row.error,
          })),
      ]
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .slice(0, eventLimit)
    : ((logsRes.data || []) as DailyBlogLogEntry[]);

  const yesterday = days.find((d) => d.date === addDaysIst(today, -1));
  const twoDays = days.slice(0, 3);
  const underPosted = twoDays.filter((d) => d.date !== today && d.posted < d.expected);
  const todayDue = dueSlotIndexes(schedule).length;
  const enabled = opts?.settings?.enabled !== false;
  const lastStatus = String(opts?.settings?.last_status || '');
  const lastError = opts?.settings?.last_error || null;

  let diagnosis: DailyBlogOpsSnapshot['diagnosis'];
  if (!enabled) {
    diagnosis = {
      level: 'warn',
      title: 'Auto-post paused',
      message: 'Daily auto-post is off. Enable it from the schedule card, then use Post now for missed slots.',
    };
  } else if (lastStatus === 'failed' && lastError && (todayRow?.posted || 0) === 0) {
    diagnosis = {
      level: 'error',
      title: 'Last run failed',
      message: lastError,
    };
  } else if ((todayRow?.posted || 0) === 0 && todayDue > 0) {
    diagnosis = {
      level: 'error',
      title: `Aaj ${todayDue} slot due, 0 post`,
      message:
        'Aaj ka due slot abhi live nahi hai. Cron / Post now sirf aaj ke IST slots nikalte hain — pichle din ke missed blogs skip rehte hain.',
    };
  } else if ((todayRow?.missing || 0) > 0) {
    diagnosis = {
      level: 'warn',
      title: `Aaj ${todayRow?.posted || 0}/${todayRow?.expected || schedule.posts_per_day} posted`,
      message: `Missed slot(s) after the IST time. Last live daily post: ${lastSuccess || 'none'}.`,
    };
  } else if (yesterday && yesterday.posted < yesterday.expected) {
    diagnosis = {
      level: 'ok',
      title: `Aaj ${todayRow?.posted || 0}/${todayRow?.expected || schedule.posts_per_day} posted`,
      message: `Kal ${yesterday.posted}/${yesterday.expected} miss tha. Aaj ke live posts theek hain.`,
    };
  } else if (underPosted.length) {
    diagnosis = {
      level: 'warn',
      title: 'Recent days incomplete',
      message: underPosted.map((d) => `${d.date}: ${d.posted}/${d.expected}`).join(' · '),
    };
  } else {
    diagnosis = {
      level: 'ok',
      title: 'On schedule',
      message: `Today ${todayRow?.posted || 0}/${schedule.posts_per_day} · ${schedule.label}`,
    };
  }

  return {
    table_missing: tableMissing,
    enabled,
    last_status: lastStatus || null,
    last_error: lastError,
    last_run_at: opts?.settings?.last_run_at || null,
    last_success_at: lastSuccess,
    posts_per_day: schedule.posts_per_day,
    post_times: schedule.times,
    schedule_label: schedule.label,
    today,
    today_posted: todayRow?.posted || 0,
    today_due: todayDue,
    days,
    events,
    diagnosis,
  };
}
