import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron/assertCronAuth';
import { getProbesForSync } from '@/lib/status/publicStatus';
import { syncAutomatedStatusIncident } from '@/lib/status/autoIncidentSync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authError = await assertCronAuth(req);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }
  try {
    const probes = await getProbesForSync();
    const result = await syncAutomatedStatusIncident(probes, { force: true });
    return NextResponse.json({
      ok: true,
      ...result,
      at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'sync failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}