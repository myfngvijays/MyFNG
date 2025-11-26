/**
 * Generate QR Code for Payment API
 * Phase 1.3 - Payment Options
 * Purpose: Generate UPI QR code for invoice payment
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// QRCode will be imported dynamically if available
let QRCode: any = null;
try {
  QRCode = require('qrcode');
} catch (e) {
  // QRCode package not installed, will use fallback
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoiceId = params.id;

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, lead:service_leads!lead_id(id, customer_name, customer_phone)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get or create payment intent
    let { data: paymentIntent } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('invoice_id', invoiceId)
      .eq('status', 'CREATED')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // If no payment intent, create one
    if (!paymentIntent) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { data: newIntent, error: intentError } = await supabase
        .from('payment_intents')
        .insert({
          invoice_id: invoiceId,
          lead_id: invoice.lead_id,
          amount: parseFloat(invoice.final_amount || '0'),
          currency: 'INR',
          allowed_methods: ['UPI'],
          status: 'CREATED',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (intentError) {
        return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 });
      }

      paymentIntent = newIntent;
    }

    // Generate UPI payment string
    const upiId = process.env.UPI_ID || 'myfng@paytm';
    const amount = paymentIntent.amount;
    const customerName = invoice.lead?.customer_name || 'Customer';
    const invoiceNumber = invoice.invoice_number;
    
    // UPI payment string format: upi://pay?pa=<UPI_ID>&pn=<PayeeName>&am=<Amount>&cu=INR&tn=<TransactionNote>
    const upiString = `upi://pay?pa=${upiId}&pn=MyFNG&am=${amount}&cu=INR&tn=Invoice ${invoiceNumber}`;

    // Generate QR code
    let qrCodeDataUrl: string;
    if (QRCode) {
      try {
        qrCodeDataUrl = await QRCode.toDataURL(upiString, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
      } catch (qrError) {
        console.error('Error generating QR code:', qrError);
        // Fallback to external QR code service
        qrCodeDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiString)}`;
      }
    } else {
      // Use external QR code service as fallback
      qrCodeDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiString)}`;
    }

    // Update payment intent with QR code
    await supabase
      .from('payment_intents')
      .update({
        qr_code_data: upiString,
        qr_code_url: qrCodeDataUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentIntent.id);

    return NextResponse.json({
      success: true,
      qr_code_url: qrCodeDataUrl,
      qr_code_data: upiString,
      upi_id: upiId,
      amount: amount,
      invoice_number: invoiceNumber,
      payment_intent_id: paymentIntent.id,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in generate QR code API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

