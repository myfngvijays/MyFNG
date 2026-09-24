import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { istDateString } from '@/lib/blog/dailyTopics';
import { dueSlotIndexes, resolveDailyBlogSchedule } from '@/lib/blog/dailyBlogSlots';
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

export function formatLogReason(reason?: string | null) {
  switch (String(reason || '')) {
    case 'waiting_for_next_slot':
      return 'Waiting for next IST slot';
    case 'already_posted_today':
      return 'All due slots already posted';
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

  const dailyBlogs = (blogsRes.data || []).filter((row: any) => {
    const seo = row?.seo_data || {};
    return Boolean(seo.ai_daily_post) && !seo.ai_batch_post;
  });

  const days: DailyBlogDaySummary[] = [];
  for (let i = 0; i < dayCount; i += 1) {
    const date = addDaysIst(today, -i);
    const blogs = dailyBlogs
      .filter((row: any) => istDateFromIso(row.published_at) === date)
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
          run_date: istDateFromIso(row.published_at),
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
        'Cron hit nahi hua, OpenAI fail hua, ya catch-up skip ho gaya. Hourly Cronon + cart catch-up dono check karo. Post now se missed slot turant nikal sakte ho.',
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
