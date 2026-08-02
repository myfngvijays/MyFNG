import { NextRequest, NextResponse } from 'next/server';
import { runCartAbandonedReminderJob } from '@/lib/services/cartAbandonedReminderJob';
import { isWhatsAppCronJobEnabled } from '@/lib/services/whatsappCronJobFlags';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function assertCronAuth(req: NextRequest): string | null {
  const secret = process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;
  if (!secret) return 'CRON secret is not configured on server';

  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== secret) return 'Unauthorized';
  return null;
}

export async function GET(request: NextRequest) {
  const authError = assertCronAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  if (!(await isWhatsAppCronJobEnabled('cart-abandoned-reminders'))) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'job_disabled_in_admin',
      timestamp: new Date().toISOString(),
    });
  }

  const result = await runCartAbandonedReminderJob();
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    result,
  });
}
