import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || '';

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));

  const razorpayPaymentId = String(body.razorpay_payment_id || '');
  const razorpayOrderId = String(body.razorpay_order_id || '');
  const razorpaySignature = String(body.razorpay_signature || '');
  if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
    return NextResponse.json({ error: 'Payment verification details are required' }, { status: 400 });
  }

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  if (expectedSignature !== razorpaySignature) {
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { data: membership } = await supabaseAdmin
    .from('customer_memberships')
    .select('*, plan:membership_plans(*)')
    .eq('customer_id', customer.id)
    .eq('status', 'ACTIVE')
    .gt('ends_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'No active membership found' }, { status: 400 });
  }
  if (membership.has_second_car) {
    return NextResponse.json({ error: '2nd car add-on is already active' }, { status: 400 });
  }

  // 2nd car shares the same membership row — do not extend or reset starts_at / ends_at.
  const updates: Record<string, unknown> = {
    has_second_car: true,
    updated_at: nowIso,
    second_vehicle_id: body.second_vehicle_id || null,
    second_vehicle_snapshot: body.second_vehicle_snapshot || {},
  };

  let { data: updated, error } = await supabaseAdmin
    .from('customer_memberships')
    .update(updates)
    .eq('id', membership.id)
    .select('*, plan:membership_plans(*)')
    .single();

  if (error && /does not exist|column/i.test(error.message || '')) {
    ({ data: updated, error } = await supabaseAdmin
      .from('customer_memberships')
      .update({ has_second_car: true, updated_at: nowIso })
      .eq('id', membership.id)
      .select('*, plan:membership_plans(*)')
      .single());
  }

  if (error || !updated) {
    return NextResponse.json(
      { error: 'Failed to activate 2nd car add-on', details: error?.message },
      { status: 500 },
    );
  }

  await logCustomerEvent(supabaseAdmin, customer.id, 'membership_second_car_addon', 'membership', {
    membershipId: membership.id,
    paymentId: razorpayPaymentId,
    orderId: razorpayOrderId,
  });

  return NextResponse.json({
    success: true,
    membership: updated,
    membership_ends_at: updated.ends_at,
    note: 'Second car uses the same membership validity as your primary car.',
  });
}
