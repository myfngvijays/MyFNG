import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron/assertCronAuth';
import { runDailyBlogPost } from '@/lib/blog/runDailyBlogPost';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Daily AI blogs for admin-configured IST slots (1–5). Cronon hits this hourly.
 * Trigger: Supabase Cronon job `daily-blog-auto-post` (see database/368_daily_blog_pg_cron.sql).
 * GET /api/cron/daily-blog?force=1
 */
async function handle(request: NextRequest) {
  const authError = await assertCronAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get('force') === '1';
  const result = await runDailyBlogPost({ force });

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
