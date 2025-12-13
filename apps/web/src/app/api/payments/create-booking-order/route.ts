/**
 * Payment Order Creation API for Booking Flow
 * Creates Razorpay order for service booking (no authentication required)
 */

import { NextResponse } from 'next/server';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

export async function POST(request: Request) {
  try {
    const { amount, customerName, customerPhone, customerEmail } = await request.json();

    // Validate input
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (!customerName || !customerPhone) {
      return NextResponse.json({ error: 'Customer details required' }, { status: 400 });
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        {
          error: 'Payment gateway not configured',
          hint: 'Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET on server environment',
        },
        { status: 500 }
      );
    }

    // Convert to paise (Razorpay uses smallest currency unit)
    const amountInPaise = Math.round(amount * 100);

    // Create Razorpay order
    const orderData = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `BOOK_${Date.now()}`,
      notes: {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || '',
        booking_type: 'SERVICE_BOOKING',
      },
    };

    // Create Razorpay order via API
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify(orderData),
    });

    if (!razorpayResponse.ok) {
      const errorData = await razorpayResponse.json();
      console.error('Razorpay API Error:', errorData);
      return NextResponse.json(
        { error: errorData.error?.description || 'Failed to create Razorpay order' },
        { status: razorpayResponse.status }
      );
    }

    const order = await razorpayResponse.json();

    return NextResponse.json({
      success: true,
      order: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
      },
    });

  } catch (error: any) {
    console.error('Error creating payment order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment order' },
      { status: 500 }
    );
  }
}

