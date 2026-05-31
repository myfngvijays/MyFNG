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
    return NextResponse.json(
      { error: 'Payment gateway not configured', hint: 'Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET' },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const planId = String(body.plan_id || '');
  const addSecondCar = Boolean(body.add_second_car);
  if (!planId) return NextResponse.json({ error: 'plan_id is required' }, { status: 400 });

  const { data: plan } = await supabaseAdmin
    .from('membership_plans')
    .select('*')
    .eq('id', planId)
    .eq('active', true)
    .maybeSingle();

  if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  const SECOND_CAR_ADDON_PRICE = 299;
  const baseAmount = Number(plan.price || 0);
  const amount = baseAmount + (addSecondCar ? SECOND_CAR_ADDON_PRICE : 0);
  if (amount <= 0) return NextResponse.json({ error: 'Plan has no price' }, { status: 400 });

  const amountInPaise = Math.round(amount * 100);

  const authHeader = 'Basic ' + Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
  const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `MEM_${customer.id.substring(0, 8)}_${Date.now()}`,
      notes: {
        customer_id: customer.id,
        plan_id: plan.id,
        plan_name: plan.name,
        type: 'membership',
        add_second_car: addSecondCar ? 'yes' : 'no',
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
    plan_id: plan.id,
    plan_name: plan.name,
  });
}
