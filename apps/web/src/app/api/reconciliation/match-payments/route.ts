import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reconciliation/match-payments
 * Auto-match payments with bank/PG settlements
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      settlement_date = new Date().toISOString().split('T')[0],
      provider = 'RAZORPAY',
      settlement_data = [] // Array of {txn_ref, amount, date}
    } = body;

    // Get unreconciled payments for the date
    const { data: payments } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('status', 'SUCCESS')
      .eq('reconciled', false)
      .gte('completed_at', `${settlement_date}T00:00:00`)
      .lte('completed_at', `${settlement_date}T23:59:59`);

    const matched = [];
    const unmatched = [];
    const exceptions = [];

    // Auto-match by transaction reference and amount
    for (const settlementTxn of settlement_data) {
      const matchedPayment = payments?.find(p => 
        (p.gateway_payment_id === settlementTxn.txn_ref || 
         p.upi_txn_id === settlementTxn.txn_ref) &&
        Math.abs(parseFloat(p.amount) - parseFloat(settlementTxn.amount)) < 0.01
      );

      if (matchedPayment) {
        // Mark as reconciled
        await supabase
          .from('payment_transactions')
          .update({
            reconciled: true,
            reconciled_at: new Date().toISOString(),
            reconciled_by: user.id
          })
          .eq('id', matchedPayment.id);

        matched.push({
          payment_id: matchedPayment.id,
          txn_ref: settlementTxn.txn_ref,
          amount: settlementTxn.amount
        });
      } else {
        // Create exception for unmatched
        const { data: exception } = await supabase
          .from('recon_exceptions')
          .insert({
            exception_type: 'SETTLEMENT_NOT_FOUND',
            exception_data: settlementTxn,
            status: 'PENDING'
          })
          .select()
          .single();

        exceptions.push(exception);
        unmatched.push(settlementTxn);
      }
    }

    // Check for payments not in settlement (missing from bank)
    const unmatchedPayments = payments?.filter(p => 
      !matched.find(m => m.payment_id === p.id)
    ) || [];

    for (const payment of unmatchedPayments) {
      await supabase
        .from('recon_exceptions')
        .insert({
          payment_id: payment.id,
          invoice_id: payment.invoice_id,
          lead_id: payment.lead_id,
          exception_type: 'PAYMENT_NOT_IN_SETTLEMENT',
          exception_data: {
            payment_id: payment.id,
            txn_id: payment.transaction_id,
            gateway_payment_id: payment.gateway_payment_id,
            amount: payment.amount,
            completed_at: payment.completed_at
          },
          status: 'PENDING'
        });
    }

    return NextResponse.json({
      success: true,
      reconciliation_summary: {
        date: settlement_date,
        provider,
        total_settlement_txns: settlement_data.length,
        matched_count: matched.length,
        unmatched_count: unmatched.length,
        payments_not_in_settlement: unmatchedPayments.length,
        exceptions_created: exceptions.length + unmatchedPayments.length
      },
      matched,
      unmatched,
      exceptions
    });

  } catch (error: any) {
    console.error('Reconciliation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

