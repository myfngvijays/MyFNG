import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron/assertCronAuth';
import { runWelcomeBonusExpiryPush } from '@/lib/wallet/welcomeBonusExpiryPush';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Welcome bonus expiry pushes:
 * - Once at 15 days left
 * - Daily when 7..0 days left (through expiry day)
 *
 * Auth: x-vercel-cron: 1 or Authorization: Bearer CRON_SECRET
 * Optional: ?dry_run=1&limit=100
 */
async function handle(req: NextRequest) {
  const authError = await assertCronAuth(req);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get('dry_run') === '1' || searchParams.get('dryRun') === '1';
  const limit = Number(searchParams.get('limit') || 500);

  const result = await runWelcomeBonusExpiryPush({
    dryRun,
    limit: Number.isFinite(limit) ? limit : 500,
  });

  return NextResponse.json(
    {
      ...result,
      dry_run: dryRun,
      timestamp: new Date().toISOString(),
    },
    { status: result.success ? 200 : 500 },
  );
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
