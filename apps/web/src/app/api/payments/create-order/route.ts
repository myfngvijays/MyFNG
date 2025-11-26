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
  const supabase = await createClient();
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
      receipt: `INV_${invoice.invoice_number || invoiceId.substring(0, 8)}`,
      notes: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        customer_email: customerEmail || invoice.lead?.customer_email,
        customer_phone: customerPhone || invoice.lead?.customer_phone,
        lead_id: invoice.lead_id,
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

    // Create payment transaction record (PENDING status)
    const transactionId = `TXN-${Date.now()}-${invoiceId.substring(0, 8)}`;
    await supabase
      .from('payment_transactions')
      .insert({
        transaction_id: transactionId,
        invoice_id: invoiceId,
        lead_id: invoice.lead_id,
        amount: amount,
        currency: 'INR',
        payment_method: 'ONLINE',
        payment_gateway: 'RAZORPAY',
        gateway_order_id: order.id,
        status: 'PENDING',
        initiated_at: new Date().toISOString(),
        created_by: user.id,
      });

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

