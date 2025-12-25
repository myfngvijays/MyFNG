/**
 * Payment Verification API
 * Phase 4 - Task WA-501
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import { createFinanceEvent } from '@/lib/services/financeEventService';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  try {
    const { orderId, paymentId, signature, invoiceId } = await request.json();

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json({ 
        verified: false, 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Verify signature
    const text = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    const isValid = expectedSignature === signature;

    if (!isValid) {
      return NextResponse.json({
        verified: false,
        message: 'Invalid signature',
      }, { status: 400 });
    }

    // Fetch payment details from Razorpay
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
    if (!razorpayKeyId || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json({
        verified: false,
        message: 'Payment gateway not configured',
      }, { status: 500 });
    }

    const razorpayResponse = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${razorpayKeyId}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
    });

    if (!razorpayResponse.ok) {
      return NextResponse.json({
        verified: false,
        message: 'Failed to fetch payment details from Razorpay',
      }, { status: 500 });
    }

    const paymentDetails = await razorpayResponse.json();

    // If payment is not captured, return error
    if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
      return NextResponse.json({
        verified: false,
        message: `Payment status: ${paymentDetails.status}`,
      }, { status: 400 });
    }

    // Get invoice if invoiceId provided
    if (invoiceId) {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('*, lead:service_leads!lead_id(*)')
        .eq('id', invoiceId)
        .single();

      if (invoice) {
        const amount = parseFloat(paymentDetails.amount) / 100; // Convert paise to rupees
        const now = new Date().toISOString();
        const transactionId = paymentId;

        // Update payment_intents (best-effort)
        try {
          await supabase
            .from('payment_intents')
            .update({
              status: 'SUCCEEDED',
              updated_at: now,
              metadata: {
                last_event: 'verified_client',
                gateway_payment_id: paymentId,
              },
            })
            .eq('gateway_order_id', orderId);
        } catch {
          // ignore
        }

        // Update or create payment transaction
        const { data: existingTransaction } = await supabase
          .from('payment_transactions')
          .select('id')
          .eq('gateway_order_id', orderId)
          .maybeSingle();

        if (existingTransaction) {
          // Update existing transaction
          await supabase
            .from('payment_transactions')
            .update({
              gateway_payment_id: paymentId,
              gateway_signature: signature,
              status: 'SUCCESS',
              amount: amount,
              payment_method: paymentDetails.method || 'ONLINE',
              upi_id: paymentDetails.vpa || null,
              upi_txn_id: paymentDetails.id || null,
              card_last4: paymentDetails.card?.last4 || null,
              card_brand: paymentDetails.card?.network || null,
              card_type: paymentDetails.card?.type || null,
              completed_at: now,
              webhook_data: paymentDetails,
              updated_at: now,
            })
            .eq('id', existingTransaction.id);
        } else {
          // Create new transaction
          await supabase
            .from('payment_transactions')
            .insert({
              transaction_id: transactionId,
              invoice_id: invoiceId,
              lead_id: invoice.lead_id,
              amount: amount,
              currency: 'INR',
              payment_method: paymentDetails.method || 'ONLINE',
              payment_gateway: 'RAZORPAY',
              gateway_order_id: orderId,
              gateway_payment_id: paymentId,
              gateway_signature: signature,
              status: 'SUCCESS',
              upi_id: paymentDetails.vpa || null,
              upi_txn_id: paymentDetails.id || null,
              card_last4: paymentDetails.card?.last4 || null,
              card_brand: paymentDetails.card?.network || null,
              card_type: paymentDetails.card?.type || null,
              completed_at: now,
              webhook_data: paymentDetails,
              created_by: user?.id || null,
            });
        }

        // Update invoice
        const invoiceAmount = parseFloat(invoice.final_amount || invoice.total_amount || '0');
        const currentPaidAmount = parseFloat(invoice.paid_amount || '0');
        const newPaidAmount = Math.min(invoiceAmount, currentPaidAmount + amount);
        const balanceDue = Math.max(0, invoiceAmount - newPaidAmount);
        const isFullPayment = newPaidAmount >= invoiceAmount;
        await supabase
          .from('invoices')
          .update({
            payment_status: isFullPayment ? 'PAID' : 'PARTIAL',
            paid_amount: newPaidAmount,
            balance_due: balanceDue,
            payment_mode: paymentDetails.method || 'ONLINE',
            payment_txn_id: transactionId,
            paid_at: isFullPayment ? now : null,
            status: isFullPayment ? 'PAID' : 'PARTIAL',
            updated_at: now,
          })
          .eq('id', invoiceId);

        await createFinanceEvent({
          eventType: isFullPayment ? 'payment_received' : 'payment_partial',
          entityType: 'payment',
          entityId: existingTransaction?.id || transactionId,
          actorId: user?.id,
          eventData: {
            gateway: 'RAZORPAY',
            order_id: orderId,
            payment_id: paymentId,
            invoice_id: invoiceId,
            amount: amount,
          },
        });

        // Update lead status
        if (invoice.lead_id) {
          // After full payment, mark vehicle as ready for delivery
          const newLeadStatus = isFullPayment ? 'READY_FOR_DELIVERY' : 'PARTIAL_PAYMENT';
          await supabase
            .from('service_leads')
            .update({
              payment_status: isFullPayment ? 'PAID' : 'PARTIAL',
              payment_mode: paymentDetails.method || 'ONLINE',
              payment_txn_id: transactionId,
              payment_collected_at: now,
              status: newLeadStatus,
              ready_for_delivery_at: isFullPayment ? now : null,
              updated_at: now,
              read_only: isFullPayment ? true : false,
            })
            .eq('id', invoice.lead_id);

          // Log status change
          await supabase
            .from('lead_status_history')
            .insert({
              lead_id: invoice.lead_id,
              old_status: invoice.lead?.status || 'AWAITING_PAYMENT',
              new_status: newLeadStatus,
              changed_by: user?.id || null,
              changed_at: now,
              reason: 'Payment received via Razorpay',
              notes: `Payment ID: ${paymentId}, Amount: ₹${amount.toFixed(2)}`,
              metadata: {
                payment_gateway: 'RAZORPAY',
                order_id: orderId,
              },
            });

          await supabase
            .from('lead_activities')
            .insert({
              lead_id: invoice.lead_id,
              user_id: user?.id || null,
              activity_type: 'PAYMENT_RECEIVED',
              description: `Online payment of ₹${amount.toFixed(2)} received via Razorpay`,
              old_status: invoice.lead?.status || 'AWAITING_PAYMENT',
              new_status: newLeadStatus,
              metadata: {
                payment_gateway: 'RAZORPAY',
                order_id: orderId,
                payment_id: paymentId,
              }
            });
        }
      }
    }

    // Payment verified successfully
    return NextResponse.json({
      verified: true,
      message: 'Payment verified successfully',
      payment_id: paymentId,
      order_id: orderId,
      amount: paymentDetails.amount ? parseFloat(paymentDetails.amount) / 100 : null,
      status: paymentDetails.status,
    });

  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { verified: false, error: error.message },
      { status: 500 }
    );
  }
}

