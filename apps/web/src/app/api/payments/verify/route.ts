/**
 * Payment Verification API
 * Phase 4 - Task WA-501
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import crypto from 'crypto';
import { createFinanceEvent } from '@/lib/services/financeEventService';
import { generateSeriesDocumentNumber } from '@/lib/utils/invoiceUtils';
import { sendTemplateMessage, normalizePhoneNumber } from '@/lib/services/whatsappService';

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
        // NEW FLOW: payments should be captured against Customer Invoice
        if ((invoice as any).invoice_type === 'ORDER_SUMMARY') {
          return NextResponse.json(
            {
              verified: false,
              error: 'Cannot verify payment for Order Summary',
              hint: 'Payment must be made against Customer Invoice (CI).',
            },
            { status: 400 }
          );
        }

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

        // On full payment, generate Tax Invoice (TI) (GST visible) using same series suffix
        if (isFullPayment) {
          const year =
            (invoice as any).series_year ||
            (invoice.lead as any)?.invoice_series_year ||
            new Date().getFullYear();
          const month =
            (invoice as any).series_month ||
            (invoice.lead as any)?.invoice_series_month ||
            (new Date().getMonth() + 1);
          const seq =
            (invoice as any).series_seq ||
            (invoice.lead as any)?.invoice_series_seq ||
            null;

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
                payment_mode: paymentDetails.method || 'ONLINE',
                payment_txn_id: transactionId,
                paid_at: now,
                generated_by: user?.id || null,
                invoice_type: 'TAX_INVOICE',
                series_year: year,
                series_month: month,
                series_seq: seq,
                visible_to_customer: true, // visible in customer app (public link gated elsewhere)
                show_gst_breakup: true,
                line_items: (invoice as any).line_items || [],
              };

              const { data: createdTI } = await supabase
                .from('invoices')
                .insert({ ...tiPayload, created_at: now, updated_at: now })
                .select('id')
                .single();

              // Point lead.invoice_id to TI for latest invoice reference (best-effort)
              if (createdTI?.id) {
                await supabase
                  .from('service_leads')
                  .update({ invoice_id: createdTI.id, invoice_number: tiNumber, updated_at: now })
                  .eq('id', invoice.lead_id);
              }
            }
          }
        }

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
          // NEW FLOW: Payment success marks lead PAID; delivery stage is separate.
          const newLeadStatus = isFullPayment ? 'PAID' : 'PARTIAL_PAYMENT';
          await supabase
            .from('service_leads')
            .update({
              payment_status: isFullPayment ? 'PAID' : 'PARTIAL',
              payment_mode: paymentDetails.method || 'ONLINE',
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

    // For direct Pay Now (no invoice), store in direct-pay table
    let directPayUpdated = false;
    let directPayError: string | null = null;
    if (!invoiceId) {
      const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
      if (supabaseAdmin && orderId) {
        try {
          const { data: existingRow } = await supabaseAdmin
            .from('Razorpay_Direct_pay_RSA')
            .select('customer_name, customer_email, customer_phone, notes')
            .eq('order_id', orderId)
            .maybeSingle();

          const { error: upErr } = await supabaseAdmin
            .from('Razorpay_Direct_pay_RSA')
            .upsert(
              {
                order_id: orderId,
                payment_id: paymentId,
                signature: signature,
                amount: paymentDetails.amount ? parseFloat(paymentDetails.amount) / 100 : null,
                amount_paise: paymentDetails.amount ? parseInt(paymentDetails.amount, 10) : null,
                currency: paymentDetails.currency || 'INR',
                status: 'SUCCESS',
                customer_name: existingRow?.customer_name || 'Customer',
                customer_email: existingRow?.customer_email || null,
                customer_phone: existingRow?.customer_phone || '',
                notes: existingRow?.notes || { purpose: 'PAY_NOW' },
                razorpay_payload: paymentDetails,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'order_id' }
            );
          if (upErr) {
            directPayError = upErr.message;
          } else {
            directPayUpdated = true;
          }
        } catch (e: any) {
          directPayError = e?.message || 'Failed to update direct pay record';
        }
      } else {
        directPayError = adminErr || 'Supabase admin not configured';
      }
    }

    // Auto-send payment_success WhatsApp notification
    try {
      const { supabaseAdmin: adminForNotif } = getSupabaseAdmin();
      const dbNotif = adminForNotif as any;
      if (dbNotif && orderId) {
        const { data: payRow } = await dbNotif
          .from('Razorpay_Direct_pay_RSA')
          .select('customer_name, customer_phone, amount, notes')
          .eq('order_id', orderId)
          .maybeSingle();

        const custPhone = payRow?.customer_phone
          || paymentDetails?.notes?.customer_phone
          || paymentDetails?.contact
          || '';
        const custName = payRow?.customer_name
          || paymentDetails?.notes?.customer_name
          || 'Customer';
        const amt = payRow?.amount || (paymentDetails.amount ? parseFloat(paymentDetails.amount) / 100 : 0);

        console.log('[Verify] WhatsApp notification lookup:', {
          orderId,
          payRowFound: !!payRow,
          custPhone,
          custName,
          amt,
        });

        const normalized = normalizePhoneNumber(custPhone);
        if (normalized) {
          const amtStr = Number(amt) % 1 === 0 ? String(Number(amt)) : Number(amt).toFixed(2);
          const result = await sendTemplateMessage({
            phoneNumber: custPhone,
            templateName: 'payment_success',
            templateParams: [custName, amtStr, paymentId || orderId, 'MyFNG Service'],
            languageCode: 'en',
          });
          console.log('[Verify] WhatsApp payment_success result:', {
            success: result?.success,
            messageId: result?.messageId,
            error: result?.error,
          });
          const now = new Date().toISOString();
          await dbNotif.from('whatsapp_messages').insert({
            provider_message_id: result.messageId || null,
            direction: 'OUTBOUND',
            message_type: 'TEMPLATE',
            recipient_phone: normalized,
            template_name: 'payment_success',
            template_language: 'en',
            status: result.success ? 'SENT' : 'FAILED',
            status_at: now,
            error_message: result.success ? null : result.error || null,
            payload: { request: { type: 'payment_success', customer: custName, amount: amt, phone: custPhone }, response: result.raw || null },
            meta: { source: 'payment_verify_auto' },
            updated_at: now,
          });
        } else {
          console.warn('[Verify] No valid phone for WhatsApp notification:', custPhone);
        }
      }
    } catch (e) {
      console.error('[Verify] Failed to send payment_success WhatsApp:', e);
    }

    // Payment verified successfully
    return NextResponse.json({
      verified: true,
      message: 'Payment verified successfully',
      payment_id: paymentId,
      order_id: orderId,
      amount: paymentDetails.amount ? parseFloat(paymentDetails.amount) / 100 : null,
      status: paymentDetails.status,
      direct_pay_updated: directPayUpdated,
      direct_pay_error: directPayError,
    });

  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { verified: false, error: error.message },
      { status: 500 }
    );
  }
}

