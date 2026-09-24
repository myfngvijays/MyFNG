import { NextResponse } from 'next/server';
import { requireBlogAdmin } from '@/lib/blog/requireBlogAdmin';
import { loadDailyBlogSettings } from '@/lib/blog/runDailyBlogPost';
import { loadDailyBlogOpsSnapshot } from '@/lib/blog/dailyBlogLog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireBlogAdmin();
  if ('response' in auth) return auth.response;

  const loaded = await loadDailyBlogSettings();
  const snapshot = await loadDailyBlogOpsSnapshot({
    days: 7,
    eventLimit: 120,
    settings: loaded.settings,
  });

  return NextResponse.json({
    missing_settings: Boolean(loaded.missing),
    settings_error: loaded.error || null,
    ...snapshot,
  });
}
