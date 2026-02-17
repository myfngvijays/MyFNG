/**
 * Razorpay Webhook Handler
 * Handles payment events from Razorpay
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import { createFinanceEvent } from '@/lib/services/financeEventService';
import { generateSeriesDocumentNumber } from '@/lib/utils/invoiceUtils';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

async function updateDirectPayStatus(params: {
  orderId?: string | null;
  paymentId?: string | null;
  signature?: string | null;
  status: 'SUCCESS' | 'FAILED';
  amountPaise?: number | null;
  currency?: string | null;
  payload: any;
}) {
  const orderId = String(params.orderId || '').trim();
  if (!orderId) return;

  const now = new Date().toISOString();
  const { supabaseAdmin } = getSupabaseAdmin();
  const db = (supabaseAdmin ?? await createClient()) as any;

  const { data: existingRow } = await db
    .from('Razorpay_Direct_pay_RSA')
    .select('customer_name, customer_email, customer_phone, signature, notes')
    .eq('order_id', orderId)
    .maybeSingle();

  await db
    .from('Razorpay_Direct_pay_RSA')
    .upsert(
      {
        order_id: orderId,
        payment_id: params.paymentId || null,
        signature: params.signature || existingRow?.signature || null,
        amount: Number.isFinite(params.amountPaise as number) ? Number(params.amountPaise) / 100 : null,
        amount_paise: Number.isFinite(params.amountPaise as number) ? Number(params.amountPaise) : null,
        currency: params.currency || 'INR',
        status: params.status,
        customer_name: existingRow?.customer_name || 'Customer',
        customer_email: existingRow?.customer_email || null,
        customer_phone: existingRow?.customer_phone || '',
        notes: existingRow?.notes || { purpose: 'PAY_NOW' },
        razorpay_payload: params.payload,
        updated_at: now,
      },
      { onConflict: 'order_id' }
    );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';

    // Verify webhook signature
    if (!WEBHOOK_SECRET && !RAZORPAY_KEY_SECRET) {
      console.error('Razorpay webhook secret not configured (RAZORPAY_WEBHOOK_SECRET/RAZORPAY_KEY_SECRET)');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

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

  // Keep telecaller direct-pay status in sync even if frontend verify callback is skipped.
  await updateDirectPayStatus({
    orderId,
    paymentId,
    status: 'SUCCESS',
    amountPaise: Number(payment?.amount || 0),
    currency: payment?.currency || 'INR',
    payload,
  });

  // Find transaction by order ID (preferred) or payment ID (idempotency)
  let { data: transaction } = await supabase
    .from('payment_transactions')
    .select('*, invoice:invoices!invoice_id(*)')
    .or(`gateway_order_id.eq.${orderId},gateway_payment_id.eq.${paymentId}`)
    .order('initiated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!transaction) {
    // Fallback: if transaction row was not created, try payment_intents as source of truth
    const { data: intentRow } = await supabase
      .from('payment_intents')
      .select('id, invoice_id, lead_id')
      .eq('gateway_order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (intentRow?.invoice_id) {
      // Create a minimal pending transaction so existing logic can proceed and so ops dashboards have a row.
      const { data: createdTxn } = await supabase
        .from('payment_transactions')
        .insert({
          transaction_id: `TXN-${Date.now()}-${String(intentRow.invoice_id).substring(0, 8)}`,
          invoice_id: intentRow.invoice_id,
          lead_id: intentRow.lead_id,
          amount: amount,
          currency: 'INR',
          payment_method: payment.method || 'ONLINE',
          payment_gateway: 'RAZORPAY',
          gateway_order_id: orderId,
          gateway_payment_id: paymentId,
          status: 'SUCCESS',
          initiated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          webhook_received_at: new Date().toISOString(),
          webhook_data: payload,
          updated_at: new Date().toISOString(),
        })
        .select('*, invoice:invoices!invoice_id(*)')
        .single();
      transaction = createdTxn || null;
    }

    // Fallback: try invoice_id from notes (if present)
    const invoiceIdFromNotes = payment?.notes?.invoice_id;
    if (invoiceIdFromNotes) {
      const { data: txn2 } = await supabase
        .from('payment_transactions')
        .select('*, invoice:invoices!invoice_id(*)')
        .eq('invoice_id', invoiceIdFromNotes)
        .eq('payment_gateway', 'RAZORPAY')
        .order('initiated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      transaction = txn2 || null;
    }
    if (!transaction) {
      console.error('Transaction not found for order:', orderId);
      return;
    }
  }

  const now = new Date().toISOString();

  // Update payment_intents (best-effort) so chat/payment links can reflect status without joining transactions.
  try {
    await supabase
      .from('payment_intents')
      .update({
        status: 'SUCCEEDED',
        updated_at: now,
        metadata: {
          last_event: 'payment_success',
          gateway_payment_id: paymentId,
        },
      })
      .eq('gateway_order_id', orderId);
  } catch {
    // ignore
  }

  // Idempotency: already processed
  if (transaction.status === 'SUCCESS' && transaction.gateway_payment_id === paymentId) {
    return;
  }

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

    // NEW FLOW: never treat Order Summary as payable invoice
    if ((invoice as any)?.invoice_type === 'ORDER_SUMMARY') {
      console.warn('Webhook received payment for ORDER_SUMMARY invoice_id. Ignoring lead status updates.', {
        invoice_id: transaction.invoice_id,
        order_id: orderId,
        payment_id: paymentId,
      });
      return;
    }

    const invoiceAmount = parseFloat(invoice.final_amount || invoice.total_amount || '0');
    const currentPaidAmount = parseFloat(invoice.paid_amount || '0');
    const newPaidAmount = Math.min(invoiceAmount, currentPaidAmount + amount);
    const balanceDue = Math.max(0, invoiceAmount - newPaidAmount);
    const isFullPayment = newPaidAmount >= invoiceAmount;
    const transactionId = paymentId;

    await supabase
      .from('invoices')
      .update({
        payment_status: isFullPayment ? 'PAID' : 'PARTIAL',
        paid_amount: newPaidAmount,
        balance_due: balanceDue,
        payment_mode: payment.method || 'ONLINE',
        payment_txn_id: transactionId,
        paid_at: isFullPayment ? now : null,
        status: isFullPayment ? 'PAID' : 'PARTIAL',
        updated_at: now,
      })
      .eq('id', transaction.invoice_id);

    await createFinanceEvent({
      eventType: isFullPayment ? 'payment_received' : 'payment_partial',
      entityType: 'payment',
      entityId: transaction.id,
      eventData: {
        gateway: 'RAZORPAY',
        order_id: orderId,
        payment_id: paymentId,
        amount: amount,
        invoice_id: transaction.invoice_id,
      },
      ipAddress: undefined,
      userAgent: undefined,
    });

    // On full payment, generate Tax Invoice (TI) (GST visible) using same series suffix
    if (isFullPayment && invoice.lead_id) {
      const year =
        (invoice as any).series_year ||
        new Date().getFullYear();
      const month =
        (invoice as any).series_month ||
        (new Date().getMonth() + 1);
      const seq = (invoice as any).series_seq || null;

      if (seq) {
        const tiNumber = generateSeriesDocumentNumber('TI', year, month, seq);
        const { data: existingTI } = await supabase
          .from('invoices')
          .select('id')
          .eq('lead_id', invoice.lead_id)
          .eq('invoice_type', 'TAX_INVOICE')
          .maybeSingle();

        if (!existingTI?.id) {
          const tiPayload: any = {
            invoice_number: tiNumber,
            lead_id: invoice.lead_id,
            workshop_id: (invoice as any).workshop_id,
            base_amount: (invoice as any).base_amount || 0,
            parts_cost: (invoice as any).parts_cost || 0,
            extra_charges: (invoice as any).extra_charges || 0,
            labour_cost: (invoice as any).labour_cost || 0,
            sub_total: (invoice as any).sub_total || (invoice as any).subtotal || 0,
            discount_amount: (invoice as any).discount_amount || 0,
            cgst_percentage: (invoice as any).cgst_percentage || 0,
            cgst_amount: (invoice as any).cgst_amount || 0,
            sgst_percentage: (invoice as any).sgst_percentage || 0,
            sgst_amount: (invoice as any).sgst_amount || 0,
            igst_percentage: (invoice as any).igst_percentage || 0,
            igst_amount: (invoice as any).igst_amount || 0,
            total_tax: (invoice as any).total_tax || 0,
            round_off_amount: (invoice as any).round_off_amount || 0,
            final_amount: invoiceAmount,
            amount_in_words: (invoice as any).amount_in_words || null,
            place_of_supply: (invoice as any).place_of_supply || null,
            place_of_supply_state_code: (invoice as any).place_of_supply_state_code || null,
            status: 'PAID',
            payment_status: 'PAID',
            paid_amount: invoiceAmount,
            payment_mode: payment.method || 'ONLINE',
            payment_txn_id: transactionId,
            paid_at: now,
            generated_by: null,
            invoice_type: 'TAX_INVOICE',
            series_year: year,
            series_month: month,
            series_seq: seq,
            visible_to_customer: true,
            show_gst_breakup: true,
            line_items: (invoice as any).line_items || [],
            created_at: now,
            updated_at: now,
          };
          const { data: createdTI } = await supabase
            .from('invoices')
            .insert(tiPayload)
            .select('id')
            .single();

          if (createdTI?.id) {
            await supabase
              .from('service_leads')
              .update({ invoice_id: createdTI.id, invoice_number: tiNumber, updated_at: now })
              .eq('id', invoice.lead_id);
          }
        }
      }
    }

    // Update lead status
    if (invoice.lead_id) {
      // NEW FLOW: Payment success marks lead PAID; delivery is separate.
      const newLeadStatus = isFullPayment ? 'PAID' : 'PARTIAL_PAYMENT';
      await supabase
        .from('service_leads')
        .update({
          payment_status: isFullPayment ? 'PAID' : 'PARTIAL',
          payment_mode: payment.method || 'ONLINE',
          payment_txn_id: transactionId,
          payment_collected_at: now,
          status: newLeadStatus,
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
          metadata: {
            payment_gateway: 'RAZORPAY',
            order_id: orderId,
          },
        });

      // Activity log
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: invoice.lead_id,
          user_id: null,
          activity_type: 'PAYMENT_RECEIVED',
          description: `Online payment of ₹${amount.toFixed(2)} received via Razorpay`,
          old_status: 'AWAITING_PAYMENT',
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

async function handlePaymentFailed(payload: any, supabase: any) {
  const payment = payload.payment?.entity || payload;
  const orderId = payment.order_id;
  const paymentId = payment.id;
  const failureReason = payment.error_description || payment.error_code || 'Payment failed';

  const now = new Date().toISOString();

  await updateDirectPayStatus({
    orderId,
    paymentId,
    status: 'FAILED',
    amountPaise: Number(payment?.amount || 0),
    currency: payment?.currency || 'INR',
    payload,
  });

  // Update payment_intents (best-effort)
  try {
    await supabase
      .from('payment_intents')
      .update({
        status: 'FAILED',
        updated_at: now,
        metadata: {
          last_event: 'payment_failed',
          gateway_payment_id: paymentId,
          failure_reason: failureReason,
        },
      })
      .eq('gateway_order_id', orderId);
  } catch {
    // ignore
  }

  // Find transaction
  const { data: transaction } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('gateway_order_id', orderId)
    .maybeSingle();

  if (transaction) {
    await supabase
      .from('payment_transactions')
      .update({
        gateway_payment_id: paymentId,
        status: 'FAILED',
        failure_reason: failureReason,
        failed_at: now,
        webhook_received_at: now,
        webhook_data: payload,
        updated_at: now,
      })
      .eq('id', transaction.id);

    await createFinanceEvent({
      eventType: 'payment_failed',
      entityType: 'payment',
      entityId: transaction.id,
      eventData: {
        gateway: 'RAZORPAY',
        order_id: orderId,
        payment_id: paymentId,
        failure_reason: failureReason,
      },
    });
  }
}

async function handleOrderPaid(payload: any, supabase: any) {
  // Order paid event - similar to payment captured
  await handlePaymentSuccess(payload, supabase);
}

