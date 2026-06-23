import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import { createMembershipPaymentOrder } from '@/lib/membership-create-order';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));

  if (!Boolean(body.post_booking_bundle)) {
    return NextResponse.json({ error: 'post_booking_bundle is required' }, { status: 400 });
  }

  const result = await createMembershipPaymentOrder({
    customer,
    supabaseAdmin,
    body,
    request,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, hint: 'hint' in result ? result.hint : undefined, details: 'details' in result ? result.details : undefined },
      { status: result.status },
    );
  }

  return NextResponse.json(result.payload);
}
