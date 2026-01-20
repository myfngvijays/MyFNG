import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const amount = Number(body?.amount || 0);
    const customerName = String(body?.customerName || '').trim();
    const customerEmail = body?.customerEmail ? String(body.customerEmail).trim() : null;
    const customerPhone = String(body?.customerPhone || '').trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (!customerName || !customerPhone) {
      return NextResponse.json({ error: 'Customer name and phone are required' }, { status: 400 });
    }
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 });
    }

    const amountInPaise = Math.round(amount * 100);
    const orderData = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `DIRECT_${Date.now()}`,
      notes: {
        purpose: 'PAY_NOW',
        customer_name: customerName,
        customer_email: customerEmail || '',
        customer_phone: customerPhone,
      },
    };

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify(orderData),
    });

    if (!razorpayResponse.ok) {
      const errorData = await razorpayResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData?.error?.description || 'Failed to create Razorpay order' },
        { status: razorpayResponse.status }
      );
    }

    const order = await razorpayResponse.json();

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (supabaseAdmin) {
      await supabaseAdmin
        .from('Razorpay_Direct_pay_RSA')
        .insert({
          order_id: order.id,
          amount: amount,
          amount_paise: amountInPaise,
          currency: order.currency || 'INR',
          status: 'CREATED',
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          notes: { purpose: 'PAY_NOW' },
          razorpay_payload: order,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
    } else {
      console.warn('[create-direct-order] Supabase admin missing:', adminErr);
    }
    return NextResponse.json({
      success: true,
      order: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create payment order' },
      { status: 500 }
    );
  }
}

