import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/create-intent
 * Create payment intent for online payment (Razorpay)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Allow unauthenticated for customer-facing flow
    const body = await request.json();
    const { invoice_id, payment_method = 'RAZORPAY' } = body;

    if (!invoice_id) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });
    }

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        lead:service_leads!inner(
          id, lead_number, customer_name, customer_phone, customer_email
        )
      `)
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.payment_status === 'PAID') {
      return NextResponse.json({ 
        error: 'Invoice already paid',
        payment_status: invoice.payment_status
      }, { status: 400 });
    }

    const lead = invoice.lead as any;
    const invoiceAmount = parseFloat(invoice.final_amount || invoice.total_amount || '0');
    const currentPaid = parseFloat(invoice.paid_amount || '0');
    const remaining = Math.max(0, invoiceAmount - currentPaid);

    if (remaining <= 0) {
      return NextResponse.json({
        error: 'Invoice already settled',
        payment_status: invoice.payment_status,
        remaining_amount: remaining
      }, { status: 400 });
    }

    const amountInPaise = Math.round(remaining * 100);

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
    if (!razorpayKeyId || !razorpayKeySecret) {
      return NextResponse.json({
        error: 'Payment gateway not configured',
        hint: 'Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET'
      }, { status: 500 });
    }

    // Create Razorpay order
    const receipt = `INV_${invoice.invoice_number || invoice_id.substring(0, 8)}`;
    const orderData = {
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        invoice_id: invoice_id,
        invoice_number: invoice.invoice_number,
        lead_id: lead.id,
        lead_number: lead.lead_number,
        customer_name: lead.customer_name,
        customer_phone: lead.customer_phone,
      },
    };

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64')}`,
      },
      body: JSON.stringify(orderData),
    });

    if (!razorpayResponse.ok) {
      let errMsg = 'Failed to create Razorpay order';
      try {
        const err = await razorpayResponse.json();
        errMsg = err?.error?.description || errMsg;
      } catch {}
      return NextResponse.json({ error: errMsg }, { status: razorpayResponse.status });
    }

    const razorpayOrder = await razorpayResponse.json();

    // Create payment transaction record
    const { data: paymentTxn, error: txnError } = await supabase
      .from('payment_transactions')
      .insert({
        invoice_id,
        lead_id: lead.id,
        amount: remaining,
        payment_method: payment_method === 'RAZORPAY' ? 'ONLINE' : payment_method,
        payment_gateway: 'RAZORPAY',
        gateway_order_id: razorpayOrder.id,
        transaction_id: `TXN-${Date.now()}-${invoice_id.substring(0, 8)}`,
        status: 'PENDING',
        initiated_at: new Date().toISOString(),
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (txnError) {
      console.error('Payment transaction creation error:', txnError);
      return NextResponse.json({ 
        error: 'Failed to create payment transaction',
        details: txnError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
      },
      payment_intent: {
        id: paymentTxn.id,
        order_id: razorpayOrder.id,
        amount: remaining,
        amount_paise: amountInPaise,
        currency: 'INR',
        razorpay_key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID
      },
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        total_amount: invoice.total_amount,
        final_amount: invoice.final_amount,
        paid_amount: invoice.paid_amount,
        remaining_amount: remaining,
      },
      customer: {
        name: lead.customer_name,
        phone: lead.customer_phone,
        email: lead.customer_email
      }
    });

  } catch (error: any) {
    console.error('Payment intent creation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

