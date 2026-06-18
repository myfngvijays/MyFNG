import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!razorpayKeyId || !razorpayKeySecret) {
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 });
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
    return NextResponse.json({ error: '2nd car add-on is already active on your membership' }, { status: 400 });
  }

  const plan = (membership as any).plan;
  const amount = Number(plan?.second_car_addon_price) || 299;
  const amountInPaise = Math.round(amount * 100);

  const authHeader = 'Basic ' + Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
  const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `MEM2ND_${customer.id.substring(0, 8)}_${Date.now()}`,
      notes: {
        customer_id: customer.id,
        membership_id: membership.id,
        plan_id: membership.plan_id,
        type: 'membership_second_car_addon',
      },
    }),
  });

  if (!orderRes.ok) {
    const errBody = await orderRes.text().catch(() => '');
    return NextResponse.json({ error: 'Failed to create payment order', details: errBody }, { status: 500 });
  }

  const order = await orderRes.json();
  return NextResponse.json({
    success: true,
    order_id: order.id,
    amount_paise: amountInPaise,
    amount,
    currency: 'INR',
    razorpay_key: razorpayKeyId,
    membership_id: membership.id,
  });
}
