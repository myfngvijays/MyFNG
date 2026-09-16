import { listPublicGoogleReviews } from '@/lib/customer-reviews-public';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

export async function GET(request: NextRequest) {
  const screen = String(request.nextUrl.searchParams.get('screen') || 'home').toLowerCase() === 'rsa'
    ? 'rsa'
    : 'home';
  const limit = Number(request.nextUrl.searchParams.get('limit') || 8);

  try {
    const data = await listPublicGoogleReviews({ screen, limit });
    return NextResponse.json({ data }, { headers: CACHE_HEADERS });
  } catch (e) {
    console.error('[public/customer-reviews]', e);
    return NextResponse.json({ data: [] }, { headers: CACHE_HEADERS });
  }
}
