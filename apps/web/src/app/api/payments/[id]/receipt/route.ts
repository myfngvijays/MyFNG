import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';
import { sendEmail } from '@/lib/services/emailService';
import { sendSMS } from '@/lib/services/smsService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/[id]/generate-receipt
 * Generate receipt PDF and send to customer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const paymentId = params.id;
    const body = await request.json();
    const { send_to_customer = true, channels = ['email', 'sms'] } = body;

    // Get payment details
    const { data: payment, error: paymentError } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        invoice:invoices!inner(
          *,
          lead:service_leads!inner(
            id, lead_number, customer_name, customer_phone, customer_email
          ),
          workshop:workshops(name, address, city, state, phone, email, gst_number)
        )
      `)
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.status !== 'SUCCESS') {
      return NextResponse.json({ 
        error: 'Cannot generate receipt for unsuccessful payment',
        payment_status: payment.status
      }, { status: 400 });
    }

    // Check if receipt already exists
    if (payment.receipt_number && payment.receipt_url) {
      return NextResponse.json({
        success: true,
        message: 'Receipt already exists',
        receipt: {
          receipt_number: payment.receipt_number,
          receipt_url: payment.receipt_url,
          receipt_generated_at: payment.receipt_generated_at
        },
        already_exists: true
      });
    }

    const invoice = payment.invoice as any;
    const lead = invoice.lead as any;
    const workshop = invoice.workshop as any;

    // Generate receipt number
    const receiptNumber = `RCP-${Date.now()}-${payment.transaction_id.substr(-6)}`;
    const now = new Date().toISOString();

    // Generate receipt PDF (placeholder - implement with PDF library)
    // For now, we'll create a receipt URL pointing to a view endpoint
    const receiptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/receipts/${paymentId}`;

    // Update payment with receipt details
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payment_transactions')
      .update({
        receipt_number: receiptNumber,
        receipt_url: receiptUrl,
        receipt_generated_at: now
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating payment:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update payment',
        details: updateError.message
      }, { status: 500 });
    }

    // Update invoice receipt fields
    await supabase
      .from('invoices')
      .update({
        receipt_url: receiptUrl,
        receipt_generated_at: now,
        receipt_sent_at: send_to_customer ? now : null
      })
      .eq('id', invoice.id);

    // Create finance event
    await createFinanceEvent({
      event_type: 'receipt_generated',
      entity_type: 'payment',
      entity_id: paymentId,
      actor_id: user?.id,
      event_data: {
        payment_id: paymentId,
        invoice_id: invoice.id,
        lead_id: lead.id,
        receipt_number: receiptNumber,
        amount: payment.amount,
        payment_method: payment.payment_method
      }
    });

    // Send receipt to customer
    const sendResults: any = { email: false, sms: false };

    if (send_to_customer) {
      // Email
      if (channels.includes('email') && lead.customer_email) {
        try {
          const emailSent = await sendEmail(
            lead.customer_email,
            `Payment Receipt - ${receiptNumber}`,
            `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="text-align: center; padding: 20px; background: #10B981; color: white;">
                  <h2>Payment Receipt</h2>
                </div>
                <div style="padding: 20px; background: #F9FAFB;">
                  <h3>Payment Successful!</h3>
                  <p>Dear ${lead.customer_name},</p>
                  <p>Thank you for your payment. Here are the details:</p>
                  <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Receipt Number:</strong> ${receiptNumber}</p>
                    <p><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
                    <p><strong>Lead Number:</strong> ${lead.lead_number}</p>
                    <p><strong>Amount Paid:</strong> ₹${payment.amount}</p>
                    <p><strong>Payment Method:</strong> ${payment.payment_method}</p>
                    <p><strong>Transaction ID:</strong> ${payment.transaction_id}</p>
                    <p><strong>Date:</strong> ${new Date(payment.completed_at).toLocaleString()}</p>
                  </div>
                  <p><a href="${receiptUrl}" style="background: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Receipt</a></p>
                  <p>Workshop: ${workshop?.name || 'N/A'}</p>
                  <p>For queries, contact: ${workshop?.phone || 'support'}</p>
                </div>
              </div>
            `
          );
          sendResults.email = emailSent;
        } catch (err) {
          console.error('Email send error:', err);
        }
      }

      // SMS
      if (channels.includes('sms') && lead.customer_phone) {
        try {
          const smsSent = await sendSMS(
            lead.customer_phone,
            `Payment received! Receipt: ${receiptNumber}. Amount: ₹${payment.amount}. Invoice: ${invoice.invoice_number}. Thank you! - ${workshop?.name || 'Workshop'}`
          );
          sendResults.sms = smsSent;
        } catch (err) {
          console.error('SMS send error:', err);
        }
      }

      // Log receipt sending
      await supabase
        .from('invoice_sharing_logs')
        .insert({
          invoice_id: invoice.id,
          shared_by: user?.id,
          sharing_method: 'EMAIL',
          recipient_email: lead.customer_email,
          sharing_status: sendResults.email ? 'SENT' : 'FAILED',
          sharing_link: receiptUrl,
          shared_at: now
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Receipt generated successfully',
      receipt: {
        receipt_number: receiptNumber,
        receipt_url: receiptUrl,
        receipt_generated_at: now,
        payment_amount: payment.amount,
        payment_method: payment.payment_method
      },
      sent_to_customer: send_to_customer,
      send_results: sendResults
    });

  } catch (error: any) {
    console.error('Error generating receipt:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/payments/[id]/receipt
 * Get receipt details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const paymentId = params.id;

    const { data: payment, error } = await supabase
      .from('payment_transactions')
      .select(`
        receipt_number,
        receipt_url,
        receipt_generated_at,
        amount,
        payment_method,
        transaction_id,
        completed_at,
        invoice:invoices!inner(
          invoice_number,
          lead:service_leads!inner(customer_name, lead_number)
        )
      `)
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      receipt: payment
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

