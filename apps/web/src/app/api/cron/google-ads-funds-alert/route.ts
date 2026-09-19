import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron/assertCronAuth';
import { isWhatsAppCronJobEnabled } from '@/lib/services/whatsappCronJobFlags';
import { runGoogleAdsFundsAlert } from '@/lib/google-ads/fundsAlert';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const JOB_ID = 'google-ads-funds-alert';

async function handle(request: NextRequest) {
  const authError = await assertCronAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }
  if (!(await isWhatsAppCronJobEnabled(JOB_ID))) {
    return NextResponse.json({ success: true, skipped: true, reason: 'job_disabled_in_admin', jobId: JOB_ID });
  }
  const test = request.nextUrl.searchParams.get('test') === '1' || request.nextUrl.searchParams.get('test') === 'true';
  try {
    const result = await runGoogleAdsFundsAlert({ test });
    return NextResponse.json({ success: true, jobId: JOB_ID, timestamp: new Date().toISOString(), ...result });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
