import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron/assertCronAuth';
import { syncSmartfloRecordings } from '@/lib/telecaller/smartfloCdr';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Poll Smartflo CDR and attach recording_url onto telecaller_call_logs.
 * Default: last 6 hours, every 15 minutes via vercel.json.
 */
async function handle(req: NextRequest) {
  const authError = await assertCronAuth(req);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const hoursBack = Number(searchParams.get('hours') || searchParams.get('hours_back') || 6);

  const result = await syncSmartfloRecordings({
    hoursBack: Number.isFinite(hoursBack) ? hoursBack : 6,
    maxPages: 4,
    timeBudgetMs: 50_000,
    concurrency: 6,
  });

  return NextResponse.json(
    { ...result, timestamp: new Date().toISOString() },
    { status: result.ok ? 200 : 502 },
  );
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
