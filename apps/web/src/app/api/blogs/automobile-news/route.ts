import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { requireBlogAdmin } from '@/lib/blog/requireBlogAdmin';
import { istDateString } from '@/lib/blog/dailyTopics';
import {
  AUTOMOBILE_NEWS_PER_DAY,
  countAutomobileNewsPostedToday,
  runDailyAutomobileNews,
} from '@/lib/blog/runDailyAutomobileNews';
import { AUTOMOBILE_NEWS_SCHEDULE_LABEL } from '@/lib/blog/automobileNewsSlots';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

async function newsPayload() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { error: error || 'Admin client not configured', posted_today: 0, quota: AUTOMOBILE_NEWS_PER_DAY, recent: [] };
  }

  const runDate = istDateString();
  const postedToday = await countAutomobileNewsPostedToday(supabaseAdmin, runDate);
  const { data: settings, error: settingsError } = await (supabaseAdmin as any)
    .from('daily_blog_settings')
    .select('news_enabled')
    .eq('id', 1)
    .maybeSingle();
  const pauseAvailable = !settingsError;
  const enabled = settingsError ? true : settings?.news_enabled !== false;

  const { data: rows } = await supabaseAdmin
    .from('blogs')
    .select('id, title, slug, status, views, published_at, seo_data')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(80);

  const recent = (rows || [])
    .filter((row: any) => row?.seo_data?.ai_news_car === true || row?.seo_data?.ai_news_car === 'true')
    .slice(0, 8)
    .map((row: any) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      views: Number(row.views || 0),
      published_at: row.published_at,
      auto: row?.seo_data?.ai_daily_news === true,
    }));

  return {
    enabled,
    pause_available: pauseAvailable,
    posted_today: postedToday,
    quota: AUTOMOBILE_NEWS_PER_DAY,
    schedule: AUTOMOBILE_NEWS_SCHEDULE_LABEL,
    run_date: runDate,
    recent,
  };
}

export async function GET() {
  const auth = await requireBlogAdmin();
  if ('response' in auth && auth.response) return auth.response;
  try {
    return NextResponse.json(await newsPayload());
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load news' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireBlogAdmin();
  if ('response' in auth && auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: error || 'Admin client not configured' }, { status: 500 });

  const { error: updateError } = await (supabaseAdmin as any)
    .from('daily_blog_settings')
    .update({ news_enabled: Boolean(body.enabled), updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (updateError) {
    const missing = /news_enabled/i.test(updateError.message || '');
    return NextResponse.json(
      { error: missing ? 'Run database/383_automobile_news_pg_cron.sql so Pause can be saved.' : updateError.message },
      { status: 500 },
    );
  }
  return NextResponse.json(await newsPayload());
}

export async function POST() {
  const auth = await requireBlogAdmin();
  if ('response' in auth && auth.response) return auth.response;
  const run = await runDailyAutomobileNews({ ignorePause: true });
  const payload = await newsPayload().catch(() => ({}));
  return NextResponse.json(
    { ...payload, run },
    { status: run.success ? 200 : 500 },
  );
}
