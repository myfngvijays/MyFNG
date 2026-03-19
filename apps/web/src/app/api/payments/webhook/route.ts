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
import { sendTemplateMessage, normalizePhoneNumber } from '@/lib/services/whatsappService';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

async function sendPaymentWhatsAppNotification(opts: {
  type: 'success' | 'failed';
  customerPhone: string;
  customerName: string;
  amount: number;
  paymentId?: string;
  service?: string;
  paymentLink?: string;
}) {
  const phone = normalizePhoneNumber(opts.customerPhone);
  if (!phone) return;

  const name = opts.customerName || 'Customer';
  const amt = opts.amount.toFixed(2);
  const service = opts.service || 'Vehicle Service';
  const { supabaseAdmin } = getSupabaseAdmin();

  try {
    let result;
    if (opts.type === 'success') {
      result = await sendTemplateMessage({
        phoneNumber: opts.customerPhone,
        templateName: 'payment_success',
        templateParams: [name, amt, opts.paymentId || 'N/A', service],
        languageCode: 'en',
      });
    } else {
      result = await sendTemplateMessage({
        phoneNumber: opts.customerPhone,
        templateName: 'payment_failed',
        templateParams: [name, amt, service, opts.paymentLink || ''],
        languageCode: 'en',
      });
    }

    if (supabaseAdmin && result) {
      const now = new Date().toISOString();
      await supabaseAdmin.from('whatsapp_messages').insert({
        provider_message_id: result.messageId || null,
        direction: 'OUTBOUND',
        message_type: 'TEMPLATE',
        sender_phone: null,
        recipient_phone: phone,
        template_name: opts.type === 'success' ? 'payment_success' : 'payment_failed',
        template_language: 'en',
        text_body: null,
        status: result.success ? 'SENT' : 'FAILED',
        status_at: now,
        error_message: result.success ? null : result.error || null,
        payload: { request: { type: opts.type, ...opts }, response: result.raw || null },
        meta: { source: 'razorpay_webhook_auto' },
        updated_at: now,
      });
    }

    console.log(`[Webhook] WhatsApp payment_${opts.type} sent to ${phone}:`, result?.success);
  } catch (e) {
    console.error(`[Webhook] Failed to send payment_${opts.type} WhatsApp:`, e);
  }
}

async function lookupDirectPayRow(db: any, orderId?: string, paymentId?: string) {
  if (!db) return null;
  if (orderId) {
    const { data } = await db
      .from('Razorpay_Direct_pay_RSA')
      .select('customer_name, customer_phone, amount, notes')
      .eq('order_id', orderId)
      .maybeSingle();
    if (data) return data;
  }
  if (paymentId) {
    const { data } = await db
      .from('Razorpay_Direct_pay_RSA')
      .select('customer_name, customer_phone, amount, notes')
      .eq('payment_id', paymentId)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

async function updateDirectPayStatus(params: {
  orderId?: string | null;
  paymentId?: string | null;
  linkRef?: string | null;
  signature?: string | null;
  status: 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CANCELLED' | 'EXPIRED';
  amountPaise?: number | null;
  currency?: string | null;
  payload: any;
}) {
  const orderId = String(params.orderId || '').trim();
  const paymentId = String(params.paymentId || '').trim();
  const linkRef = String(params.linkRef || '').trim();

  const now = new Date().toISOString();
  const { supabaseAdmin } = getSupabaseAdmin();
  const db = (supabaseAdmin ?? await createClient()) as any;

  let existingRow: any = null;

  if (orderId) {
    const { data } = await db
      .from('Razorpay_Direct_pay_RSA')
      .select('id, order_id, customer_name, customer_email, customer_phone, signature, notes')
      .eq('order_id', orderId)
      .maybeSingle();
    existingRow = data || null;
  }

  if (!existingRow && paymentId) {
    const { data } = await db
      .from('Razorpay_Direct_pay_RSA')
      .select('id, order_id, customer_name, customer_email, customer_phone, signature, notes')
      .eq('payment_id', paymentId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    existingRow = data || null;
  }

  if (!existingRow && linkRef) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await db
      .from('Razorpay_Direct_pay_RSA')
      .select('id, order_id, customer_name, customer_email, customer_phone, signature, notes, created_at, updated_at')
      .gte('created_at', since)
      .order('updated_at', { ascending: false })
      .limit(1000);
    existingRow =
      (rows || []).find((row: any) => {
        const notes = row?.notes && typeof row.notes === 'object' ? row.notes : {};
        return String((notes as any)?.link_ref || '').trim() === linkRef;
      }) || null;
  }

  const resolvedOrderId = String(orderId || existingRow?.order_id || '').trim();
  if (!resolvedOrderId && !existingRow?.id) return;

  const notes = existingRow?.notes && typeof existingRow.notes === 'object' ? existingRow.notes : {};
  const mergedNotes = {
    ...notes,
    ...(linkRef ? { link_ref: linkRef } : {}),
  };

  const payloadToSave = {
    ...(existingRow?.razorpay_payload && typeof existingRow.razorpay_payload === 'object' ? existingRow.razorpay_payload : {}),
    last_event: params.payload,
  };

  if (resolvedOrderId) {
    await db
      .from('Razorpay_Direct_pay_RSA')
      .upsert(
        {
          order_id: resolvedOrderId,
          payment_id: paymentId || existingRow?.payment_id || null,
          signature: params.signature || existingRow?.signature || null,
          amount: Number.isFinite(params.amountPaise as number) ? Number(params.amountPaise) / 100 : existingRow?.amount ?? null,
          amount_paise: Number.isFinite(params.amountPaise as number) ? Number(params.amountPaise) : existingRow?.amount_paise ?? null,
          currency: params.currency || existingRow?.currency || 'INR',
          status: params.status,
          customer_name: existingRow?.customer_name || 'Customer',
          customer_email: existingRow?.customer_email || null,
          customer_phone: existingRow?.customer_phone || '',
          notes: mergedNotes,
          razorpay_payload: payloadToSave,
          updated_at: now,
        },
        { onConflict: 'order_id' }
      );
    return;
  }

  await db
    .from('Razorpay_Direct_pay_RSA')
    .update({
      payment_id: paymentId || existingRow?.payment_id || null,
      signature: params.signature || existingRow?.signature || null,
      amount: Number.isFinite(params.amountPaise as number) ? Number(params.amountPaise) / 100 : existingRow?.amount ?? null,
      amount_paise: Number.isFinite(params.amountPaise as number) ? Number(params.amountPaise) : existingRow?.amount_paise ?? null,
      currency: params.currency || existingRow?.currency || 'INR',
      status: params.status,
      notes: mergedNotes,
      razorpay_payload: payloadToSave,
      updated_at: now,
    })
    .eq('id', existingRow.id);
}

async function fetchRazorpayPayment(paymentId: string) {
  const id = String(paymentId || '').trim();
  if (!id || !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return null;

  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
    },
  });
  if (!response.ok) return null;
  return await response.json().catch(() => null);
}

async function handlePaymentLinkPaid(payload: any, supabase: any) {
  const paymentFromPayload = payload?.payment?.entity || null;
  const linkEntity = payload?.payment_link?.entity || payload?.payment_link || {};
  const paymentId =
    String(paymentFromPayload?.id || linkEntity?.payment_id || payload?.payment_id || '').trim();
  const linkRef = String(linkEntity?.reference_id || linkEntity?.notes?.link_ref || '').trim();
  const payment = paymentFromPayload || (paymentId ? await fetchRazorpayPayment(paymentId) : null);

  if (!payment) {
    await updateDirectPayStatus({
      paymentId,
      linkRef,
      status: 'SUCCESS',
      amountPaise: Number(linkEntity?.amount_paid || 0),
      currency: String(linkEntity?.currency || 'INR'),
      payload,
    });
    return;
  }

  if (linkRef) {
    payment.notes = {
      ...(payment.notes && typeof payment.notes === 'object' ? payment.notes : {}),
      link_ref: linkRef,
    };
  }
  await handlePaymentSuccess({ payment: { entity: payment } }, supabase);
}

async function handlePaymentLinkTerminalStatus(payload: any, status: 'CANCELLED' | 'EXPIRED') {
  const linkEntity = payload?.payment_link?.entity || payload?.payment_link || payload?.entity || {};
  const paymentId = String(linkEntity?.payment_id || payload?.payment_id || '').trim();
  const linkRef = String(linkEntity?.reference_id || linkEntity?.notes?.link_ref || '').trim();
  await updateDirectPayStatus({
    paymentId,
    linkRef,
    status,
    amountPaise: Number(linkEntity?.amount || 0),
    currency: String(linkEntity?.currency || 'INR'),
    payload,
  });
}

async function handleRefundEvent(payload: any, supabase: any, eventName: string) {
  const refund = payload?.refund?.entity || payload?.entity || payload;
  const paymentId = String(refund?.payment_id || '').trim();
  const refundedPaise = Number(refund?.amount || 0);
  const now = new Date().toISOString();
  if (!paymentId) return;

  const { data: transaction } = await supabase
    .from('payment_transactions')
    .select('id, amount, status')
    .eq('gateway_payment_id', paymentId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const capturedPaise = transaction?.amount ? Math.round(Number(transaction.amount) * 100) : 0;
  const nextStatus =
    capturedPaise > 0 && refundedPaise >= capturedPaise ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

  if (transaction?.id) {
    await supabase
      .from('payment_transactions')
      .update({
        status: nextStatus,
        webhook_received_at: now,
        webhook_data: payload,
        updated_at: now,
      })
      .eq('id', transaction.id);
  }

  await updateDirectPayStatus({
    paymentId,
    status: nextStatus as 'REFUNDED' | 'PARTIALLY_REFUNDED',
    amountPaise: refundedPaise || undefined,
    currency: String(refund?.currency || 'INR'),
    payload,
  });

  if (transaction?.id) {
    await createFinanceEvent({
      eventType: eventName === 'refund.processed' ? 'refund_processed' : 'refund_created',
      entityType: 'payment',
      entityId: transaction.id,
      eventData: {
        gateway: 'RAZORPAY',
        payment_id: paymentId,
        refund_id: String(refund?.id || ''),
        amount_paise: refundedPaise,
        status: nextStatus,
      },
    });
  }
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

      case 'payment_link.paid':
      case 'payment.link.paid':
      case 'payment_link.partially_paid':
      case 'payment.link.partially_paid':
        await handlePaymentLinkPaid(event.payload, supabase);
        break;

      case 'payment_link.cancelled':
      case 'payment.link.cancelled':
        await handlePaymentLinkTerminalStatus(event.payload, 'CANCELLED');
        break;

      case 'payment_link.expired':
      case 'payment.link.expired':
        await handlePaymentLinkTerminalStatus(event.payload, 'EXPIRED');
        break;

      case 'refund.created':
      case 'refund.processed':
        await handleRefundEvent(event.payload, supabase, event.event);
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

  // Auto-send payment_success WhatsApp template to customer
  const { supabaseAdmin: adminForLookup } = getSupabaseAdmin();
  const dbLookup = (adminForLookup ?? supabase) as any;
  const directPayRow = await lookupDirectPayRow(dbLookup, orderId, paymentId);
  const customerPhone = directPayRow?.customer_phone || payment?.contact || '';
  if (customerPhone) {
    const notes = directPayRow?.notes && typeof directPayRow.notes === 'object' ? directPayRow.notes : {};
    await sendPaymentWhatsAppNotification({
      type: 'success',
      customerPhone,
      customerName: directPayRow?.customer_name || payment?.notes?.customer_name || 'Customer',
      amount,
      paymentId: paymentId || orderId,
      service: (notes as any)?.purpose === 'PAY_NOW' ? 'MyFNG Service' : 'Vehicle Service',
    });
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

  // Auto-send payment_failed WhatsApp template with retry link
  const { supabaseAdmin: adminForFailed } = getSupabaseAdmin();
  const dbFailed = (adminForFailed ?? supabase) as any;
  const failedRow = await lookupDirectPayRow(dbFailed, orderId, paymentId);
  const failedPhone = failedRow?.customer_phone || payment?.contact || '';
  if (failedPhone) {
    const failedNotes = failedRow?.notes && typeof failedRow.notes === 'object' ? failedRow.notes : {};
    const retryLink = String((failedNotes as any)?.link_url || '').trim();
    const failedAmount = failedRow?.amount || (Number(payment?.amount || 0) / 100);
    await sendPaymentWhatsAppNotification({
      type: 'failed',
      customerPhone: failedPhone,
      customerName: failedRow?.customer_name || payment?.notes?.customer_name || 'Customer',
      amount: failedAmount,
      service: (failedNotes as any)?.purpose === 'PAY_NOW' ? 'MyFNG Service' : 'Vehicle Service',
      paymentLink: retryLink,
    });
  }
}

async function handleOrderPaid(payload: any, supabase: any) {
  // Order paid event - similar to payment captured
  await handlePaymentSuccess(payload, supabase);
}

