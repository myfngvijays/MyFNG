/**
 * Payment Order Creation API
 * Phase 4 - Task WA-501
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { invoiceId, amount, customerEmail, customerPhone } = await request.json();

    // Validate input
    if (!invoiceId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Fetch invoice to verify
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Convert to paise (Razorpay uses smallest currency unit)
    const amountInPaise = Math.round(amount * 100);

    // Create Razorpay order
    const orderData = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `INVOICE_${invoiceId}`,
      notes: {
        invoice_id: invoiceId,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
    };

    // In production, use actual Razorpay API
    // For now, simulate order creation
    const orderId = `order_${crypto.randomBytes(16).toString('hex')}`;

    // Simulated Razorpay API call
    // const response = await fetch('https://api.razorpay.com/v1/orders', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
    //   },
    //   body: JSON.stringify(orderData),
    // });
    // const order = await response.json();

    // Simulated order response
    const order = {
      id: orderId,
      amount: amountInPaise,
      currency: 'INR',
      receipt: orderData.receipt,
      status: 'created',
    };

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

