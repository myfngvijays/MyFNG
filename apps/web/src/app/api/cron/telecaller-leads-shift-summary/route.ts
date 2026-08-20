import { NextRequest, NextResponse } from 'next/server';
import { isWhatsAppCronJobEnabled } from '@/lib/services/whatsappCronJobFlags';
import { runTelecallerLeadsShiftSummaryJob } from '@/lib/services/telecallerLeadsShiftSummary';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_ID = 'telecaller-leads-shift-summary';

function assertCronAuth(req: NextRequest): string | null {
  const secret = process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;
  if (!secret) return 'CRON secret is not configured on server';

  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== secret) return 'Unauthorized';
  return null;
}

/**
 * Daily telecaller lead counts for the office shift (7pm → next day 7pm IST).
 * GET /api/cron/telecaller-leads-shift-summary?force=1
 */
export async function GET(request: NextRequest) {
  const authError = assertCronAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  if (!(await isWhatsAppCronJobEnabled(JOB_ID))) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'job_disabled_in_admin',
      jobId: JOB_ID,
    });
  }

  const force = request.nextUrl.searchParams.get('force') === '1';
  const result = await runTelecallerLeadsShiftSummaryJob(force);

  return NextResponse.json({
    success: !('error' in result && result.error),
    jobId: JOB_ID,
    ...result,
  });
}
