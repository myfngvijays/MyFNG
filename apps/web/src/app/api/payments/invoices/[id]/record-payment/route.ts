/**
 * Record Payment API
 * Step 6: Collect Payment - Record cash/POS/other offline payments
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role, name, email')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
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

    // Verify invoice is ready for payment
    if (!['APPROVED', 'AWAITING_PAYMENT', 'INVOICE_GENERATED'].includes(invoice.status)) {
      return NextResponse.json({ 
        error: 'Invoice not ready for payment',
        current_status: invoice.status,
      }, { status: 400 });
    }

    const body = await request.json();
    const {
      payment_mode, // CASH, POS, UPI, CARD, WALLET, NETBANKING
      paid_amount,
      payment_txn_id,
      payment_reference,
      payment_remarks,
      staff_name,
    } = body;

    if (!payment_mode || !paid_amount) {
      return NextResponse.json({ 
        error: 'Payment mode and amount are required' 
      }, { status: 400 });
    }

    const paidAmount = parseFloat(paid_amount);
    const invoiceAmount = parseFloat(invoice.final_amount || '0');

    if (paidAmount <= 0 || paidAmount > invoiceAmount) {
      return NextResponse.json({ 
        error: 'Invalid payment amount' 
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const transactionId = payment_txn_id || `TXN-${Date.now()}-${invoiceId.substring(0, 8)}`;

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
        payment_gateway: payment_mode === 'CASH' ? null : 'OFFLINE',
        gateway_payment_id: payment_reference,
        status: 'SUCCESS',
        completed_at: now,
        payment_received_by: userProfile.id,
        payment_remarks: payment_remarks || `Payment received via ${payment_mode}`,
        staff_name: staff_name || userProfile.name,
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
    const isFullPayment = paidAmount >= invoiceAmount;
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update({
        payment_status: isFullPayment ? 'PAID' : 'PARTIAL',
        paid_amount: paidAmount,
        payment_mode: payment_mode,
        payment_txn_id: transactionId,
        paid_at: now,
        payment_received_by: userProfile.id,
        payment_remarks: payment_remarks || `Payment received via ${payment_mode} by ${staff_name || userProfile.name}`,
        payment_collected_at: now,
        status: isFullPayment ? 'PAID' : 'PARTIAL',
        updated_at: now,
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating invoice:', updateError);
      return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
    }

    // Update lead status
    if (invoice.lead_id) {
      // After full payment, mark vehicle as ready for delivery
      const newLeadStatus = isFullPayment ? 'READY_FOR_DELIVERY' : 'PARTIAL_PAYMENT';
      
      await supabase
        .from('service_leads')
        .update({
          payment_status: isFullPayment ? 'PAID' : 'PARTIAL',
          payment_mode: payment_mode,
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
    }

    return NextResponse.json({
      success: true,
      message: isFullPayment ? 'Payment recorded successfully' : 'Partial payment recorded',
      payment: paymentTransaction,
      invoice: updatedInvoice,
      next_step: isFullPayment ? 'Vehicle ready for delivery' : 'Awaiting remaining payment',
    }, { status: 200 });

  } catch (error) {
    console.error('Error in record payment API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

