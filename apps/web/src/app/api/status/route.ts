import { NextResponse } from 'next/server';
import { buildPublicStatus, publicPayload } from '@/lib/status/publicStatus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const full = await buildPublicStatus();
    return NextResponse.json(publicPayload(full), {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30' },
    });
  } catch {
    return NextResponse.json(
      {
        overall: 'major_outage',
        headline: 'Status is temporarily unavailable',
        updatedAt: new Date().toISOString(),
        components: [],
        incidents: [],
        maintenances: [],
        history: [],
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
