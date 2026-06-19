import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import { validateCouponForCheckout } from '@/lib/coupon-service';

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
  const couponCode = String(body.coupon_code || '').trim().toUpperCase();
  if (!planId) return NextResponse.json({ error: 'plan_id is required' }, { status: 400 });

  const { data: plan } = await supabaseAdmin
    .from('membership_plans')
    .select('*')
    .eq('id', planId)
    .eq('active', true)
    .maybeSingle();

  if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  const SECOND_CAR_ADDON_PRICE = Number(plan.second_car_addon_price) || 299;
  const baseAmount = Number(plan.price || 0);
  const grossAmount = baseAmount + (addSecondCar ? SECOND_CAR_ADDON_PRICE : 0);
  if (grossAmount <= 0) return NextResponse.json({ error: 'Plan has no price' }, { status: 400 });

  let discountAmount = 0;
  let couponMeta: Record<string, unknown> | null = null;

  if (couponCode) {
    const couponResult = await validateCouponForCheckout(supabaseAdmin, couponCode, {
      subtotal: grossAmount,
      customer_phone: customer.phone || null,
      customer_id: customer.id,
      channel: 'MEMBERSHIP',
      service_items: [{ label: `${plan.name} Membership`, price: grossAmount }],
    }, { membershipOnly: true });
    if (!couponResult.valid) {
      return NextResponse.json({ error: couponResult.error }, { status: 400 });
    }
    discountAmount = couponResult.discountAmount;
    couponMeta = couponResult.couponMeta;
  }

  const amount = Math.max(0, grossAmount - discountAmount);
  if (amount <= 0) return NextResponse.json({ error: 'Invalid payable amount after discount' }, { status: 400 });

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
        coupon_code: couponCode || '',
        discount_amount: String(discountAmount),
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
    gross_amount: grossAmount,
    discount_amount: discountAmount,
    coupon_meta: couponMeta,
    currency: 'INR',
    razorpay_key: razorpayKeyId,
    plan_id: plan.id,
    plan_name: plan.name,
  });
}
