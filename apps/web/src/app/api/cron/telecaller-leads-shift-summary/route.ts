import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron/assertCronAuth';
import { isWhatsAppCronJobEnabled } from '@/lib/services/whatsappCronJobFlags';
import { runTelecallerLeadsShiftSummaryJob } from '@/lib/services/telecallerLeadsShiftSummary';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const JOB_ID = 'telecaller-leads-shift-summary';

/**
 * Daily telecaller lead counts for the office shift (7pm → next day 7pm IST).
 * Vercel cron: 13:30 UTC = 7:00 PM IST.
 * GET /api/cron/telecaller-leads-shift-summary?force=1
 */
async function handle(request: NextRequest) {
  const authError = await assertCronAuth(request);
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

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
