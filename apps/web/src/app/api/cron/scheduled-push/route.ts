import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron/assertCronAuth';
import { runScheduledPushCampaigns } from '@/lib/push/runScheduledCampaigns';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

async function handle(req: NextRequest) {
  const authError = await assertCronAuth(req);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get('dry_run') === '1' || searchParams.get('dryRun') === '1';
  const limit = Number(searchParams.get('limit') || 20);

  const result = await runScheduledPushCampaigns({
    dryRun,
    limit: Number.isFinite(limit) ? limit : 20,
  });

  return NextResponse.json(
    { ...result, dry_run: dryRun, timestamp: new Date().toISOString() },
    { status: result.success ? 200 : 500 },
  );
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
