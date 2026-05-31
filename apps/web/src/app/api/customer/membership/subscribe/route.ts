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

  await supabaseAdmin
    .from('customer_memberships')
    .insert({
      customer_id: customer.id,
      plan_id: plan.id,
      status: 'ACTIVE',
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      auto_renew: Boolean(body.auto_renew),
      source: 'PURCHASE',
      payment_id: razorpayPaymentId,
      order_id: razorpayOrderId,
    });

  await logCustomerEvent(supabaseAdmin, customer.id, 'membership_subscribed', 'membership', {
    planId,
    paymentId: razorpayPaymentId,
    orderId: razorpayOrderId,
  });
  return NextResponse.json({ success: true, plan_id: plan.id, ends_at: endsAt.toISOString() });
}

