import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron/assertCronAuth';
import { syncSmartfloRecordings } from '@/lib/telecaller/smartfloCdr';
import {
  getSmartfloRecordingsCronSettings,
  markSmartfloRecordingsCronRun,
  markSmartfloRecordingsCronSkipped,
  shouldRunSmartfloRecordingsCron,
} from '@/lib/telecaller/smartfloRecordingsCronSettings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Poll Smartflo CDR and attach recording_url onto telecaller_call_logs.
 * Vercel ticks every 5 min; admin interval/on-off live in system_settings
 * (WhatsApp Cron page → Smartflo call recordings).
 */
async function handle(req: NextRequest) {
  const authError = await assertCronAuth(req);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const force =
    searchParams.get('force') === '1' ||
    searchParams.get('force') === 'true' ||
    searchParams.get('run') === 'now';

  const settings = await getSmartfloRecordingsCronSettings();
  const gate = shouldRunSmartfloRecordingsCron(settings, { force });
  if (!gate.run) {
    await markSmartfloRecordingsCronSkipped(gate.reason);
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: gate.reason,
      retry_after_ms: gate.retry_after_ms ?? null,
      enabled: settings.enabled,
      interval_minutes: settings.interval_minutes,
      hours_back: settings.hours_back,
      last_run_at: settings.last_run_at,
      timestamp: new Date().toISOString(),
    });
  }

  const hoursParam = Number(searchParams.get('hours') || searchParams.get('hours_back') || '');
  const hoursBack = Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : settings.hours_back;

  const result = await syncSmartfloRecordings({
    hoursBack: Number.isFinite(hoursBack) ? hoursBack : 6,
    maxPages: 4,
    timeBudgetMs: 50_000,
    concurrency: 6,
  });

  const summary = result.ok
    ? `fetched=${result.fetched} with_recording=${result.with_recording} matched=${result.matched}`
    : result.error || 'sync failed';

  await markSmartfloRecordingsCronRun({ ok: Boolean(result.ok), summary });

  return NextResponse.json(
    {
      ...result,
      skipped: false,
      force: Boolean(force),
      enabled: settings.enabled,
      interval_minutes: settings.interval_minutes,
      hours_back: hoursBack,
      timestamp: new Date().toISOString(),
    },
    { status: result.ok ? 200 : 502 },
  );
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
