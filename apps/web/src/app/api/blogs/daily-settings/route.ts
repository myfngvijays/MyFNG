import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  dailyBlogScheduleInfo,
  loadDailyBlogSettings,
  refreshDailyBlogCover,
  runDailyBlogPost,
} from '@/lib/blog/runDailyBlogPost';
import { resolveDailyBlogSchedule } from '@/lib/blog/dailyBlogSlots';
import { istDateString } from '@/lib/blog/dailyTopics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

async function requireBlogAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();
  const roleCode = (profile?.roles as any)?.role_code as string | undefined;
  if (roleCode !== 'DIGITAL_MARKETING' && roleCode !== 'SUPER_ADMIN') {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { userId: user.id };
}

async function settingsPayload() {
  const loaded = await loadDailyBlogSettings();
  if (loaded.missing) {
    return {
      missing: true,
      settings: null,
      schedule: dailyBlogScheduleInfo(null),
      last_blog: null,
      error: 'Run database/365_daily_blog_auto_post.sql',
    };
  }

  const settings = loaded.settings;
  const { supabaseAdmin } = getSupabaseAdmin();
  let lastBlog: { id: string; title: string; slug: string; published_at: string | null } | null = null;
  let postedIndexes: number[] = [];
  let todaySlots: Array<{ index: number; time: string; status: string; topic?: string | null }> = [];
  if (supabaseAdmin) {
    if (settings?.last_blog_id) {
      const { data } = await supabaseAdmin
        .from('blogs')
        .select('id, title, slug, published_at')
        .eq('id', settings.last_blog_id)
        .maybeSingle();
      if (data) lastBlog = data as any;
    }
    const today = istDateString();
    let runsRes = await supabaseAdmin
      .from('daily_blog_runs')
      .select('status, slot_index, topic')
      .eq('run_date', today);
    if (runsRes.error) {
      runsRes = await supabaseAdmin
        .from('daily_blog_runs')
        .select('status, topic')
        .eq('run_date', today);
    }
    const runs = runsRes.data;
    postedIndexes = (runs || [])
      .filter((row: any) => row.status === 'success')
      .map((row: any, idx: number) => Number(row.slot_index || idx + 1));
    const resolved = resolveDailyBlogSchedule(settings);
    todaySlots = resolved.slots.map((slot) => {
      const run = (runs || []).find((row: any) => Number(row.slot_index || 1) === slot.index);
      return {
        index: slot.index,
        time: slot.time,
        status: run?.status || 'pending',
        topic: run?.topic || null,
      };
    });
  }

  return {
    missing: false,
    settings,
    schedule: dailyBlogScheduleInfo(settings, postedIndexes),
    last_blog: lastBlog,
    today_slots: todaySlots,
    today_posted_count: postedIndexes.length,
  };
}

export async function GET() {
  const auth = await requireBlogAdmin();
  if ('response' in auth) return auth.response;
  return NextResponse.json(await settingsPayload());
}

export async function PATCH(request: NextRequest) {
  const auth = await requireBlogAdmin();
  if ('response' in auth) return auth.response;

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.enabled === 'boolean') patch.enabled = body.enabled;
  if (typeof body?.city === 'string' && body.city.trim()) patch.city = body.city.trim().slice(0, 80);
  if (typeof body?.tone === 'string' && body.tone.trim()) patch.tone = body.tone.trim().slice(0, 80);
  if (body?.word_count != null) {
    patch.word_count = Math.max(400, Math.min(2500, Number(body.word_count) || 600));
  }
  if (body?.posts_per_day != null || body?.post_times != null) {
    const { normalizePostTimes } = await import('@/lib/blog/dailyBlogSlots');
    const current = await loadDailyBlogSettings();
    const count = Math.max(
      1,
      Math.min(5, Number(body.posts_per_day ?? current.settings?.posts_per_day ?? 1) || 1),
    );
    patch.posts_per_day = count;
    patch.post_times = normalizePostTimes(body.post_times ?? current.settings?.post_times, count);
  }
  if (body?.category_id !== undefined) {
    patch.category_id = body.category_id ? String(body.category_id) : null;
  }
  if (body?.author_id !== undefined) {
    patch.author_id = body.author_id ? String(body.author_id) : null;
  }

  const { error } = await supabaseAdmin.from('daily_blog_settings').update(patch).eq('id', 1);
  if (error) {
    return NextResponse.json(
      {
        error: missingSql(error.message)
          ? 'Run database/365_daily_blog_auto_post.sql and database/369_daily_blog_slots.sql'
          : /posts_per_day|post_times|slot_index/i.test(error.message)
            ? 'Run database/369_daily_blog_slots.sql to enable multi-post daily schedule'
            : error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(await settingsPayload());
}

export async function POST(request: NextRequest) {
  const auth = await requireBlogAdmin();
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '');
  if (action === 'refresh_cover') {
    const result = await refreshDailyBlogCover({ slug: body?.slug ? String(body.slug) : undefined });
    return NextResponse.json({ ...await settingsPayload(), run: result }, { status: result.success ? 200 : 500 });
  }
  if (action !== 'run_now') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  const result = await runDailyBlogPost({ force: true });
  const payload = await settingsPayload();
  return NextResponse.json(
    { ...payload, run: result },
    { status: result.success ? 200 : 500 },
  );
}

function missingSql(message: string) {
  return /does not exist|relation|42P01|PGRST205/i.test(message);
}
