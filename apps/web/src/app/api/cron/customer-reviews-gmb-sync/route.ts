import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron/assertCronAuth';
import { syncCustomerReviewsFromGmb } from '@/lib/customer-reviews-gmb-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Scheduled sync: GMB → customer_reviews (4★ & 5★ only).
 * Auth: x-vercel-cron: 1 or Authorization: Bearer CRON_SECRET
 */
async function handle(req: NextRequest) {
  const authError = await assertCronAuth(req);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const minStars = Number(searchParams.get('min_stars') || 4);
  const screen = (searchParams.get('screen') || 'both') as 'home' | 'rsa' | 'both';

  const result = await syncCustomerReviewsFromGmb({
    screen,
    minStars: Number.isFinite(minStars) ? minStars : 4,
  });

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
