import { NextRequest, NextResponse } from 'next/server';
import { runCartAbandonedReminderJob } from '@/lib/services/cartAbandonedReminderJob';
import { isWhatsAppCronJobEnabled } from '@/lib/services/whatsappCronJobFlags';
import { assertCronAuth } from '@/lib/cron/assertCronAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 180;

export async function GET(request: NextRequest) {
  const authError = await assertCronAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  let dailyBlog: unknown = null;
  try {
    const { maybeCatchUpDailyBlog } = await import('@/lib/blog/runDailyBlogPost');
    dailyBlog = await maybeCatchUpDailyBlog({ source: 'cart_catchup' });
  } catch (error) {
    dailyBlog = { skipped: true, reason: error instanceof Error ? error.message : 'daily_blog_catchup_failed' };
  }

  if (!(await isWhatsAppCronJobEnabled('cart-abandoned-reminders'))) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'job_disabled_in_admin',
      timestamp: new Date().toISOString(),
      daily_blog: dailyBlog,
    });
  }

  const result = await runCartAbandonedReminderJob();
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    result,
    daily_blog: dailyBlog,
  });
}
