import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/invoices/[id]/payments/record
 * Record manual payment (Cash/POS/Bank Transfer)
 * For Billing Staff to record offline payments
 */
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const invoiceId = params.id;
    const body = await request.json();
    
    const {
      amount,
      payment_method, // CASH, POS, BANK_TRANSFER, CHEQUE
      transaction_reference,
      payment_remarks,
      bank_deposit_slip_url = null,
      collected_at = new Date().toISOString()
    } = body;

    // Validate
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (!payment_method) {
      return NextResponse.json({ error: 'payment_method required' }, { status: 400 });
    }

    // Get invoice
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, lead:service_leads!inner(id, lead_number)')
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const balanceDue = invoice.balance_due || invoice.total_amount;
    if (amount > balanceDue) {
      return NextResponse.json({ 
        error: 'Amount exceeds balance due',
        balance_due: balanceDue
      }, { status: 400 });
    }

    // Generate transaction ID
    const txnId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create payment transaction
    const { data: payment, error: paymentError } = await supabase
      .from('payment_transactions')
      .insert({
        transaction_id: txnId,
        invoice_id: invoiceId,
        lead_id: invoice.lead_id,
        amount,
        payment_method,
        payment_gateway: 'OFFLINE',
        gateway_order_id: transaction_reference,
        status: 'SUCCESS',
        payment_received_by: user.id,
        payment_remarks,
        staff_name: userProfile?.full_name,
        cash_collected: payment_method === 'CASH',
        cash_deposit_pending: payment_method === 'CASH' && !bank_deposit_slip_url,
        bank_deposit_slip_url,
        initiated_at: collected_at,
        completed_at: collected_at,
        created_by: user.id
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment creation error:', paymentError);
      return NextResponse.json({ 
        error: 'Failed to record payment',
        details: paymentError.message
      }, { status: 500 });
    }

    // Invoice will auto-update via trigger
    
    // Create finance event
    await createFinanceEvent({
      eventType: 'payment_received',
      entityType: 'payment',
      entityId: payment.id,
      actorId: user.id,
      actorRole: roleCode,
      eventData: {
        payment_id: payment.id,
        invoice_id: invoiceId,
        lead_id: invoice.lead_id,
        amount,
        payment_method,
        transaction_reference,
        collected_by: userProfile?.full_name
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Payment recorded successfully',
      payment,
      next_action: payment_method === 'CASH' && !bank_deposit_slip_url 
        ? 'deposit_cash_in_bank' 
        : 'payment_complete'
    });

  } catch (error: any) {
    console.error('Error recording payment:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

