import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron/assertCronAuth';
import { runDailyAutomobileNews } from '@/lib/blog/runDailyAutomobileNews';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * One original Automobile News story per call, up to 10 per IST day.
 * Slots: 10:00, 10:30, 11:00, 11:30, 12:00, 12:30, 13:00, 13:30, 14:00, 14:30 IST.
 * Cron: `*/10 4-9 * * *` UTC (every 10 minutes, 09:30–15:20 IST).
 * Each tick fills the oldest empty slot, so a missed 10:00 story is retried at 10:10.
 * Trigger: Supabase Cronon `automobile-news-auto-post` (database/383_automobile_news_pg_cron.sql).
 * Vercel cron is the backup. GET /api/cron/automobile-news?force=1 posts one extra past the quota.
 */
async function handle(request: NextRequest) {
  const authError = await assertCronAuth(request);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const force = request.nextUrl.searchParams.get('force') === '1';
  const result = await runDailyAutomobileNews({ force });
  return NextResponse.json(
    { ...result, timestamp: new Date().toISOString() },
    { status: result.success ? 200 : 500 },
  );
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
