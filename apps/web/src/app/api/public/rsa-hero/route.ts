import { getActiveRsaHeroBanner } from '@/lib/rsa/heroBanner';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const banner = await getActiveRsaHeroBanner();
  return NextResponse.json(
    { success: true, data: banner },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  );
}
