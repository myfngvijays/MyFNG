/**
 * Razorpay Webhook Handler
 * Handles payment events from Razorpay
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET || RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = JSON.parse(body);
    const supabase = await createClient();

    // Handle different event types
    switch (event.event) {
      case 'payment.captured':
      case 'payment.authorized':
        await handlePaymentSuccess(event.payload, supabase);
        break;

      case 'payment.failed':
        await handlePaymentFailed(event.payload, supabase);
        break;

      case 'order.paid':
        await handleOrderPaid(event.payload, supabase);
        break;

      default:
        console.log('Unhandled webhook event:', event.event);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(payload: any, supabase: any) {
  const payment = payload.payment?.entity || payload;
  const orderId = payment.order_id;
  const paymentId = payment.id;
  const amount = parseFloat(payment.amount) / 100; // Convert paise to rupees

  // Find transaction by order ID
  const { data: transaction } = await supabase
    .from('payment_transactions')
    .select('*, invoice:invoices!invoice_id(*)')
    .eq('gateway_order_id', orderId)
    .single();

  if (!transaction) {
    console.error('Transaction not found for order:', orderId);
    return;
  }

  const now = new Date().toISOString();

  // Update payment transaction
  await supabase
    .from('payment_transactions')
    .update({
      gateway_payment_id: paymentId,
      status: 'SUCCESS',
      amount: amount,
      payment_method: payment.method || 'ONLINE',
      upi_id: payment.vpa || null,
      upi_txn_id: paymentId,
      card_last4: payment.card?.last4 || null,
      card_brand: payment.card?.network || null,
      card_type: payment.card?.type || null,
      completed_at: now,
      webhook_received_at: now,
      webhook_data: payload,
      updated_at: now,
    })
    .eq('id', transaction.id);

  // Update invoice
  if (transaction.invoice_id) {
    const invoice = transaction.invoice;
    const isFullPayment = amount >= parseFloat(invoice.final_amount || '0');
    const transactionId = transaction.transaction_id;

    await supabase
      .from('invoices')
      .update({
        payment_status: isFullPayment ? 'PAID' : 'PARTIAL',
        paid_amount: amount,
        payment_mode: payment.method || 'ONLINE',
        payment_txn_id: transactionId,
        paid_at: now,
        status: isFullPayment ? 'PAID' : 'PARTIAL',
        updated_at: now,
      })
      .eq('id', transaction.invoice_id);

    // Update lead status
    if (invoice.lead_id) {
      // After full payment, mark vehicle as ready for delivery
      const newLeadStatus = isFullPayment ? 'READY_FOR_DELIVERY' : 'PARTIAL_PAYMENT';
      await supabase
        .from('service_leads')
        .update({
          payment_status: isFullPayment ? 'PAID' : 'PARTIAL',
          payment_mode: payment.method || 'ONLINE',
          payment_txn_id: transactionId,
          payment_collected_at: now,
          status: newLeadStatus,
          ready_for_delivery_at: isFullPayment ? now : null,
          updated_at: now,
        })
        .eq('id', invoice.lead_id);

      // Log status change
      await supabase
        .from('lead_status_history')
        .insert({
          lead_id: invoice.lead_id,
          old_status: 'AWAITING_PAYMENT',
          new_status: newLeadStatus,
          changed_at: now,
          reason: 'Payment received via Razorpay webhook',
          notes: `Payment ID: ${paymentId}, Amount: ₹${amount.toFixed(2)}`,
        });
    }
  }
}

async function handlePaymentFailed(payload: any, supabase: any) {
  const payment = payload.payment?.entity || payload;
  const orderId = payment.order_id;
  const paymentId = payment.id;
  const failureReason = payment.error_description || payment.error_code || 'Payment failed';

  // Find transaction
  const { data: transaction } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('gateway_order_id', orderId)
    .single();

  if (transaction) {
    await supabase
      .from('payment_transactions')
      .update({
        gateway_payment_id: paymentId,
        status: 'FAILED',
        failure_reason: failureReason,
        failed_at: new Date().toISOString(),
        webhook_received_at: new Date().toISOString(),
        webhook_data: payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);
  }
}

async function handleOrderPaid(payload: any, supabase: any) {
  // Order paid event - similar to payment captured
  await handlePaymentSuccess(payload, supabase);
}

