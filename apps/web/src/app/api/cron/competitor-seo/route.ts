import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron/assertCronAuth';
import { crawlActiveCompetitors, crawlCompetitor } from '@/lib/competitor-intel/crawl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 180;

async function handle(request: NextRequest) {
  const authError = await assertCronAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const competitorId = request.nextUrl.searchParams.get('competitor_id');
  const result = competitorId
    ? await crawlCompetitor(competitorId)
    : await crawlActiveCompetitors();

  const success = 'results' in result ? result.success : result.success;
  return NextResponse.json(
    { ...result, timestamp: new Date().toISOString() },
    { status: success ? 200 : result && 'missing' in result && result.missing ? 503 : 500 },
  );
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
