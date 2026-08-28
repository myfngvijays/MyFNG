import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireCustomer } from '@/lib/customer-api';
import { parseWalletPlatform } from '@/lib/wallet-config';
import { claimInstallCoupon, getInstallCouponEligibility } from '@/lib/install-coupon';

export const dynamic = 'force-dynamic';

function platformFromHeaders(headerStore: Headers) {
  return parseWalletPlatform(
    headerStore.get('x-app-platform') || headerStore.get('X-App-Platform'),
  );
}

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  try {
    const eligibility = await getInstallCouponEligibility(supabaseAdmin, customer.id);
    return NextResponse.json({ success: true, ...eligibility });
  } catch (err: any) {
    console.error('[claim-install-coupon] eligibility failed:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to check coupon eligibility' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const headerStore = await headers();
  const platform = platformFromHeaders(headerStore);

  let body: { code?: string; coupon_code?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const result = await claimInstallCoupon({
      supabaseAdmin,
      customerId: customer.id,
      code: body.code || body.coupon_code || '',
      platform,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[claim-install-coupon] failed:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to apply coupon' },
      { status: 500 },
    );
  }
}
