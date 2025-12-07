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
    const amountInPaise = Math.round(parseFloat(invoice.total_amount) * 100);

    // Create Razorpay order
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `INV_${invoice.invoice_number}`,
      notes: {
        invoice_id: invoice_id,
        lead_id: lead.id,
        lead_number: lead.lead_number,
        customer_name: lead.customer_name
      }
    });

    // Create payment transaction record
    const { data: paymentTxn, error: txnError } = await supabase
      .from('payment_transactions')
      .insert({
        invoice_id,
        lead_id: lead.id,
        amount: invoice.total_amount,
        payment_method,
        gateway_payment_id: razorpayOrder.id,
        transaction_id: razorpayOrder.receipt,
        status: 'PENDING',
        payment_gateway: 'RAZORPAY',
        initiated_at: new Date().toISOString()
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
      payment_intent: {
        id: paymentTxn.id,
        order_id: razorpayOrder.id,
        amount: invoice.total_amount,
        amount_paise: amountInPaise,
        currency: 'INR',
        razorpay_key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
      },
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        total_amount: invoice.total_amount
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

