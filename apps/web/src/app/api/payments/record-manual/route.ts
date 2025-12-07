import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/record-manual
 * Record manual payment (Cash/POS/UPI at workshop)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role - only Billing Staff, Workshop Admin, or Super Admin
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, full_name, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'BILLING_SPECIALIST', 'WORKSHOP_ADMIN'];
    
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      invoice_id,
      payment_method, // CASH, CARD_POS, UPI, BANK_TRANSFER
      amount,
      transaction_reference,
      payment_date,
      notes
    } = body;

    // Validate
    if (!invoice_id || !payment_method || !amount) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        required: ['invoice_id', 'payment_method', 'amount']
      }, { status: 400 });
    }

    // Get invoice
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, lead:service_leads!inner(*)')
      .eq('id', invoice_id)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.payment_status === 'PAID') {
      return NextResponse.json({ 
        error: 'Invoice already paid',
        payment_status: invoice.payment_status
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const lead = invoice.lead as any;

    // Create payment transaction
    const { data: payment, error: paymentError } = await supabase
      .from('payment_transactions')
      .insert({
        invoice_id,
        lead_id: lead.id,
        amount: parseFloat(amount),
        payment_method,
        transaction_id: transaction_reference || `MANUAL-${Date.now()}`,
        upi_txn_id: payment_method === 'UPI' ? transaction_reference : null,
        status: 'SUCCESS',
        payment_gateway: 'MANUAL',
        initiated_at: payment_date || now,
        completed_at: payment_date || now,
        recorded_by: user.id,
        notes
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment recording error:', paymentError);
      return NextResponse.json({ 
        error: 'Failed to record payment',
        details: paymentError.message
      }, { status: 500 });
    }

    // Update invoice
    await supabase
      .from('invoices')
      .update({
        payment_status: 'PAID',
        paid_amount: parseFloat(amount),
        payment_date: payment_date || now,
        payment_method
      })
      .eq('id', invoice_id);

    // Update lead status
    await supabase
      .from('service_leads')
      .update({
        status: 'PAID',
        updated_at: now
      })
      .eq('id', lead.id);

    // Post GL entries
    await supabase
      .from('gl_entries')
      .insert([
        {
          entry_type: 'DEBIT',
          account_type: 'ASSET',
          account_name: payment_method === 'CASH' ? 'Cash in Hand' : 'Bank Account',
          amount: parseFloat(amount),
          reference_type: 'payment',
          reference_id: payment.id,
          reference_number: payment.transaction_id,
          description: `Payment received for invoice ${invoice.invoice_number}`,
          posted_by: user.id
        },
        {
          entry_type: 'CREDIT',
          account_type: 'REVENUE',
          account_name: 'Service Revenue',
          amount: parseFloat(amount),
          reference_type: 'payment',
          reference_id: payment.id,
          reference_number: payment.transaction_id,
          description: `Payment received for invoice ${invoice.invoice_number}`,
          posted_by: user.id
        }
      ]);

    // Create finance event
    await createFinanceEvent({
      eventType: 'payment_received',
      entityType: 'payment',
      entityId: payment.id,
      actorId: user.id,
      actorRole: roleCode,
      actorName: userProfile?.full_name,
      eventData: {
        payment_id: payment.id,
        invoice_id,
        lead_id: lead.id,
        amount: parseFloat(amount),
        payment_method,
        recorded_at: now
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Payment recorded successfully',
      payment,
      invoice_updated: true,
      lead_status_updated: true
    });

  } catch (error: any) {
    console.error('Manual payment recording error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

