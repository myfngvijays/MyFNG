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
  const planId = String(body.plan_id || '');
  if (!planId) return NextResponse.json({ error: 'plan_id is required' }, { status: 400 });

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

  const { data: plan } = await supabaseAdmin.from('membership_plans').select('*').eq('id', planId).eq('active', true).maybeSingle();
  if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  const now = new Date();
  const endsAt = new Date(now.getTime() + Number(plan.duration_days || 365) * 24 * 60 * 60 * 1000);

  // Expire any previous active memberships for this customer
  await supabaseAdmin
    .from('customer_memberships')
    .update({ status: 'EXPIRED', updated_at: now.toISOString() })
    .eq('customer_id', customer.id)
    .eq('status', 'ACTIVE');

  const insertPayload = {
    customer_id: customer.id,
    plan_id: plan.id,
    status: 'ACTIVE',
    starts_at: now.toISOString(),
    ends_at: endsAt.toISOString(),
    auto_renew: Boolean(body.auto_renew),
    source: 'PURCHASE',
    has_second_car: Boolean(body.add_second_car),
    primary_vehicle_id: body.primary_vehicle_id || null,
    second_vehicle_id: body.second_vehicle_id || null,
    primary_vehicle_snapshot: body.primary_vehicle_snapshot || {},
    second_vehicle_snapshot: body.second_vehicle_snapshot || {},
  };

  let inserted: any = null;
  let insertError: any = null;
  ({ data: inserted, error: insertError } = await supabaseAdmin
    .from('customer_memberships')
    .insert(insertPayload)
    .select('*, plan:membership_plans(*)')
    .single());

  if (insertError && /does not exist|column/i.test(insertError.message || '')) {
    ({ data: inserted, error: insertError } = await supabaseAdmin
      .from('customer_memberships')
      .insert({
        customer_id: customer.id,
        plan_id: plan.id,
        status: 'ACTIVE',
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        auto_renew: Boolean(body.auto_renew),
        source: 'PURCHASE',
      })
      .select('*, plan:membership_plans(*)')
      .single());
  }

  if (insertError || !inserted) {
    console.error('[membership/subscribe] insert failed:', insertError);
    return NextResponse.json(
      { error: 'Membership activation failed', details: insertError?.message || 'Could not save membership' },
      { status: 500 },
    );
  }

  await logCustomerEvent(supabaseAdmin, customer.id, 'membership_subscribed', 'membership', {
    planId,
    paymentId: razorpayPaymentId,
    orderId: razorpayOrderId,
  });

  return NextResponse.json({
    success: true,
    plan_id: plan.id,
    ends_at: endsAt.toISOString(),
    membership: inserted,
  });
}
