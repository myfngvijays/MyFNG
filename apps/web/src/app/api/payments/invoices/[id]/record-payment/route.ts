/**
 * Record Payment API
 * Step 6: Collect Payment - Record cash/POS/other offline payments
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';
import { createNotification, notifyWorkshopAdmin, notifyCSETeam } from '@/lib/notifications';
import { generateSeriesDocumentNumber } from '@/lib/utils/invoiceUtils';

export async function POST(
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

    // Robust profile lookup (email/phone/id) + role_code
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, full_name, roles!inner(role_code)';

    const { data: byEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };
    const { data: byPhone } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };
    const { data: byId } = !byEmail && !byPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null };

    const userProfile: any = byEmail || byPhone || byId;
    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const allowedRoleCodes = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'];
    if (!allowedRoleCodes.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden', role: roleCode }, { status: 403 });
    }

    const invoiceId = params.id;

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, lead:service_leads!lead_id(*)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // NEW FLOW: payments must be collected against CUSTOMER_INVOICE (CI)
    if ((invoice as any).invoice_type === 'ORDER_SUMMARY') {
      return NextResponse.json(
        {
          error: 'Cannot record payment against Order Summary',
          hint: 'Finalize and confirm Customer Invoice (CI), then record payment against CI.',
        },
        { status: 400 }
      );
    }

    // Prevent edits after archival/closure
    if (invoice.lead?.read_only) {
      return NextResponse.json({
        error: 'Lead is archived/read-only',
        hint: 'This lead is closed and payments cannot be modified'
      }, { status: 400 });
    }

    // Verify invoice is ready for payment
    if (!['APPROVED', 'AWAITING_PAYMENT', 'INVOICE_GENERATED'].includes(invoice.status)) {
      return NextResponse.json({ 
        error: 'Invoice not ready for payment',
        current_status: invoice.status,
      }, { status: 400 });
    }

    const body = await request.json();
    const {
      payment_mode, // CASH, POS, UPI, CARD, WALLET, NETBANKING, COD
      paid_amount,
      payment_txn_id,
      payment_reference,
      payment_remarks,
      staff_name,
      is_cod = false,
      cod_due_date,
      cash_deposit_pending = false,
      bank_deposit_slip_url,
    } = body;

    if (!payment_mode || !paid_amount) {
      return NextResponse.json({ 
        error: 'Payment mode and amount are required' 
      }, { status: 400 });
    }

    // For offline modes, require audit-friendly remarks
    if (!is_cod && ['CASH', 'POS', 'UPI', 'CARD', 'NETBANKING', 'WALLET'].includes(String(payment_mode).toUpperCase())) {
      if (!payment_remarks || String(payment_remarks).trim().length < 3) {
        return NextResponse.json(
          { error: 'payment_remarks is required for offline payments' },
          { status: 400 }
        );
      }
      if (!staff_name || String(staff_name).trim().length < 2) {
        return NextResponse.json(
          { error: 'staff_name is required for offline payments' },
          { status: 400 }
        );
      }
    }

    const paidAmount = parseFloat(paid_amount);
    const invoiceAmount = parseFloat(invoice.final_amount || '0');
    const currentPaidAmount = parseFloat(invoice.paid_amount || '0');
    const balanceDue = invoiceAmount - currentPaidAmount;

    if (paidAmount <= 0) {
      return NextResponse.json({ 
        error: 'Payment amount must be greater than 0' 
      }, { status: 400 });
    }

    if (paidAmount > balanceDue) {
      return NextResponse.json({ 
        error: 'Payment amount exceeds balance due',
        balance_due: balanceDue,
        provided_amount: paidAmount,
      }, { status: 400 });
    }

    // Check for duplicate transaction
    if (payment_txn_id || payment_reference) {
      const txnRef = payment_txn_id || payment_reference;
      const { data: existingTxn } = await supabase
        .from('payment_transactions')
        .select('id, transaction_id, amount')
        .or(`transaction_id.eq.${txnRef},gateway_payment_id.eq.${txnRef}`)
        .eq('status', 'SUCCESS')
        .single();

      if (existingTxn) {
        return NextResponse.json({
          error: 'Duplicate transaction detected',
          existing_transaction: existingTxn,
        }, { status: 409 });
      }
    }

    const now = new Date().toISOString();
    const transactionId = payment_txn_id || `TXN-${Date.now()}-${invoiceId.substring(0, 8)}`;
    
    // Calculate new totals
    const newPaidAmount = currentPaidAmount + paidAmount;
    const newBalanceDue = invoiceAmount - newPaidAmount;
    const isFullPayment = newPaidAmount >= invoiceAmount;

    // Create payment transaction record
    const { data: paymentTransaction, error: transactionError } = await supabase
      .from('payment_transactions')
      .insert({
        transaction_id: transactionId,
        invoice_id: invoiceId,
        lead_id: invoice.lead_id,
        amount: paidAmount,
        currency: 'INR',
        payment_method: payment_mode,
        payment_gateway: payment_mode === 'CASH' || payment_mode === 'POS' ? 'OFFLINE' : null,
        gateway_payment_id: payment_reference,
        gateway_order_id: payment_txn_id,
        status: is_cod ? 'COD_PENDING' : 'SUCCESS',
        completed_at: is_cod ? null : now,
        payment_received_by: userProfile.id,
        payment_remarks: payment_remarks || `Payment received via ${payment_mode}`,
        staff_name: staff_name || userProfile.full_name,
        cash_deposit_pending: payment_mode === 'CASH' ? (cash_deposit_pending || false) : false,
        notes: is_cod ? `COD - Due date: ${cod_due_date || 'TBD'}` : undefined,
        created_by: userProfile.id,
        created_at: now,
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating payment transaction:', transactionError);
      return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
    }

    // Update invoice
    const updateData: any = {
      payment_status: isFullPayment ? 'PAID' : 'PARTIAL',
      paid_amount: newPaidAmount,
      balance_due: newBalanceDue,
      payment_mode: payment_mode,
      payment_txn_id: transactionId,
      payment_received_by: userProfile.id,
      payment_remarks: payment_remarks || `Payment received via ${payment_mode} by ${staff_name || userProfile.full_name}`,
      payment_collected_at: now,
      status: isFullPayment ? 'PAID' : (is_cod ? 'COD_PENDING' : 'PARTIAL'),
      updated_at: now,
    };

    if (isFullPayment && !is_cod) {
      updateData.paid_at = now;
    }

    if (is_cod) {
      updateData.cod_due_date = cod_due_date;
    }

    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating invoice:', updateError);
      return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
    }

    // Create finance event
    await createFinanceEvent({
      eventType: is_cod ? 'payment_received' : (isFullPayment ? 'payment_received' : 'payment_partial'),
      entityType: 'payment',
      entityId: paymentTransaction.id,
      actorId: userProfile.id,
      actorRole: roleCode,
      actorName: userProfile.full_name,
      eventData: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        payment_mode: payment_mode,
        amount: paidAmount,
        is_cod: is_cod,
        is_partial: !isFullPayment,
        transaction_id: transactionId,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // Update lead status
    if (invoice.lead_id) {
      // NEW FLOW: After full payment, mark lead PAID (delivery is a separate step). COD remains COD_PENDING.
      const newLeadStatus = is_cod 
        ? 'COD_PENDING'
        : isFullPayment 
        ? 'PAID' 
        : 'PARTIAL_PAYMENT';
      
      await supabase
        .from('service_leads')
        .update({
          payment_status: is_cod ? 'COD_PENDING' : (isFullPayment ? 'PAID' : 'PARTIAL'),
          payment_mode: payment_mode,
          payment_txn_id: transactionId,
          payment_collected_at: now,
          status: newLeadStatus,
          updated_at: now,
        })
        .eq('id', invoice.lead_id);

      // On full payment (non-COD), generate Tax Invoice (TI) using same series suffix
      if (isFullPayment && !is_cod) {
        const year = (invoice as any).series_year || (invoice.lead as any)?.invoice_series_year || new Date().getFullYear();
        const month = (invoice as any).series_month || (invoice.lead as any)?.invoice_series_month || (new Date().getMonth() + 1);
        const seq = (invoice as any).series_seq || (invoice.lead as any)?.invoice_series_seq || null;

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
              payment_mode: payment_mode,
              payment_txn_id: transactionId,
              paid_at: now,
              generated_by: userProfile.id,
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

      // Log status change
      await supabase
        .from('lead_status_history')
        .insert({
          lead_id: invoice.lead_id,
          old_status: invoice.lead?.status || 'AWAITING_PAYMENT',
          new_status: newLeadStatus,
          changed_by: userProfile.id,
          changed_at: now,
          reason: `Payment received: ${payment_mode}`,
          notes: `Amount: ₹${paidAmount.toFixed(2)}. ${payment_remarks || ''}`,
        });

      // Create activity log
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: invoice.lead_id,
          user_id: userProfile.id,
          activity_type: 'PAYMENT_RECEIVED',
          description: `Payment of ₹${paidAmount.toFixed(2)} received via ${payment_mode}`,
          old_status: invoice.lead?.status || 'AWAITING_PAYMENT',
          new_status: newLeadStatus,
          metadata: {
            invoice_id: invoiceId,
            invoice_number: invoice.invoice_number,
            payment_mode: payment_mode,
            paid_amount: paidAmount,
            transaction_id: transactionId,
            payment_received_by: userProfile.id,
            payment_remarks: payment_remarks,
          },
        });

      // In-app notifications (no WhatsApp dependency)
      try {
        const leadAny = invoice.lead as any;
        const leadNumber = leadAny?.lead_number || invoice.lead_id;

        if (leadAny?.workshop_id) {
          await notifyWorkshopAdmin(leadAny.workshop_id, invoice.lead_id, leadNumber, userProfile.full_name || 'Supervisor');
        }

        if (leadAny?.assigned_supervisor_id) {
          await createNotification({
            userId: leadAny.assigned_supervisor_id,
            type: 'PAYMENT_RECEIVED',
            title: 'Payment Updated',
            message: isFullPayment
              ? `Full payment received for lead ${leadNumber}. Vehicle is ready for delivery.`
              : `Payment recorded for lead ${leadNumber}. Balance pending.`,
            priority: isFullPayment ? 'HIGH' : 'MEDIUM',
            leadId: invoice.lead_id,
            leadNumber,
            actionUrl: `/dashboard/workshop_supervisor/jobs/${invoice.lead_id}`,
            metadata: { invoice_id: invoiceId, payment_mode, paid_amount: paidAmount, is_cod },
          });
        }

        if (newLeadStatus === 'PAID') {
          await notifyCSETeam(
            invoice.lead_id,
            leadNumber,
            'Payment Received',
            `Lead ${leadNumber} is fully paid.`,
            'MEDIUM'
          );
        }
      } catch (e) {
        console.warn('Notification dispatch failed (non-blocking):', e);
      }

      // Create lead event for payment (Step 13: Notifications & Audit Trail)
      await supabase
        .from('lead_events')
        .insert({
          lead_id: invoice.lead_id,
          event_type: is_cod ? 'PAYMENT_COD_RECORDED' : (isFullPayment ? 'PAYMENT_RECEIVED' : 'PAYMENT_PARTIAL'),
          event_description: `Payment of ₹${paidAmount.toFixed(2)} received via ${payment_mode}${is_cod ? ' (COD)' : ''}`,
          event_data: {
            invoice_id: invoiceId,
            invoice_number: invoice.invoice_number,
            payment_mode: payment_mode,
            paid_amount: paidAmount,
            transaction_id: transactionId,
            is_cod: is_cod,
            is_partial: !isFullPayment,
            payment_received_by: userProfile.id,
            payment_remarks: payment_remarks,
            timestamp: now,
          },
          created_by: userProfile.id,
          created_at: now,
        });

      // Auto-generate receipt for full payments (Step 5: Receipt Generation)
      if (isFullPayment && !is_cod) {
        try {
          // Call receipt generation API
          const receiptResponse = await fetch(
            `${request.nextUrl.origin}/api/payments/invoices/${invoiceId}/generate-receipt`,
            { method: 'POST' }
          );
          
          if (receiptResponse.ok) {
            const receiptData = await receiptResponse.json();
            console.log('Receipt auto-generated:', receiptData.receipt_url);
          }
        } catch (receiptError) {
          // Log error but don't fail payment recording
          console.error('Error auto-generating receipt:', receiptError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: is_cod 
        ? 'COD payment recorded. Awaiting collection.' 
        : isFullPayment 
        ? 'Payment recorded successfully' 
        : 'Partial payment recorded',
      payment: paymentTransaction,
      invoice: updatedInvoice,
      balance_due: newBalanceDue,
      is_full_payment: isFullPayment,
      is_cod: is_cod,
      next_step: is_cod
        ? 'COD payment recorded. Schedule collection.'
        : isFullPayment 
        ? 'Vehicle ready for delivery' 
        : `Awaiting remaining payment of ₹${newBalanceDue.toFixed(2)}`,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in record payment API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

