import { getTopOfferBanner } from '@/lib/top-offer-banner';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await getTopOfferBanner();
  return NextResponse.json(
    { success: true, config },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  );
}
