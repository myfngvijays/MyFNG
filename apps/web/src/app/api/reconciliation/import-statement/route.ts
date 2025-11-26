/**
 * Import Settlement Statement API
 * Phase 3 - Step 8: Accounts Reconciliation
 * Purpose: Import bank/PG settlement statements and auto-match transactions
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
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
      .select('id, role')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user has accounts permissions
    const allowedRoles = ['super_admin', 'sub_admin', 'accounts', 'finance_manager'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      report_date,
      report_type, // DAILY, WEEKLY, MONTHLY
      provider, // RAZORPAY, BANK, PHONEPE, PAYTM
      transactions, // Array of transaction objects
      file_url,
      file_name,
    } = body;

    if (!report_date || !provider || !transactions || !Array.isArray(transactions)) {
      return NextResponse.json({
        error: 'Missing required fields: report_date, provider, transactions',
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    let matchedCount = 0;
    let unmatchedCount = 0;
    const exceptions: any[] = [];

    // Calculate totals
    const totalAmount = transactions.reduce((sum: number, txn: any) => sum + parseFloat(txn.amount || '0'), 0);

    // Create settlement report
    const { data: report, error: reportError } = await supabase
      .from('settlement_reports')
      .insert({
        report_date: report_date,
        report_type: report_type || 'DAILY',
        provider: provider,
        total_amount: totalAmount,
        total_transactions: transactions.length,
        report_file_url: file_url,
        report_file_name: file_name,
        status: 'PROCESSED',
        processed_at: now,
        processed_by: userProfile.id,
      })
      .select()
      .single();

    if (reportError) {
      console.error('Error creating settlement report:', reportError);
      return NextResponse.json({ error: 'Failed to create settlement report' }, { status: 500 });
    }

    // Process each transaction
    for (const txn of transactions) {
      const txnRef = txn.transaction_id || txn.reference_id || txn.utr;
      const txnAmount = parseFloat(txn.amount || '0');

      if (!txnRef) {
        unmatchedCount++;
        exceptions.push({
          exception_type: 'MISSING_REFERENCE',
          exception_data: { transaction: txn },
          status: 'PENDING',
        });
        continue;
      }

      // Try to find matching payment transaction
      const { data: payment, error: paymentError } = await supabase
        .from('payment_transactions')
        .select('*')
        .or(`transaction_id.eq.${txnRef},gateway_payment_id.eq.${txnRef},gateway_order_id.eq.${txnRef}`)
        .eq('status', 'SUCCESS')
        .single();

      if (paymentError || !payment) {
        unmatchedCount++;
        exceptions.push({
          payment_id: null,
          exception_type: 'UNMATCHED',
          exception_data: {
            transaction: txn,
            reason: 'No matching payment found',
          },
          status: 'PENDING',
        });
        continue;
      }

      // Check amount match
      const paymentAmount = parseFloat(payment.amount || '0');
      if (Math.abs(paymentAmount - txnAmount) > 0.01) {
        unmatchedCount++;
        exceptions.push({
          payment_id: payment.id,
          exception_type: 'AMOUNT_MISMATCH',
          exception_data: {
            transaction: txn,
            payment_amount: paymentAmount,
            settlement_amount: txnAmount,
            difference: txnAmount - paymentAmount,
          },
          status: 'PENDING',
        });
        continue;
      }

      // Check if already reconciled
      if (payment.reconciled) {
        exceptions.push({
          payment_id: payment.id,
          exception_type: 'DUPLICATE',
          exception_data: {
            transaction: txn,
            reason: 'Payment already reconciled',
          },
          status: 'PENDING',
        });
        continue;
      }

      // Match found - reconcile
      await supabase
        .from('payment_transactions')
        .update({
          reconciled: true,
          reconciled_at: now,
          reconciled_by: userProfile.id,
          updated_at: now,
        })
        .eq('id', payment.id);

      matchedCount++;
    }

    // Create reconciliation exceptions
    if (exceptions.length > 0) {
      for (const exception of exceptions) {
        await supabase
          .from('recon_exceptions')
          .insert({
            ...exception,
            invoice_id: exception.payment_id ? (await supabase.from('payment_transactions').select('invoice_id').eq('id', exception.payment_id).single()).data?.invoice_id : null,
            lead_id: exception.payment_id ? (await supabase.from('payment_transactions').select('lead_id').eq('id', exception.payment_id).single()).data?.lead_id : null,
          });
      }
    }

    // Update settlement report with results
    await supabase
      .from('settlement_reports')
      .update({
        matched_count: matchedCount,
        unmatched_count: unmatchedCount,
        metadata: {
          exceptions_count: exceptions.length,
          processed_at: now,
        },
      })
      .eq('id', report.id);

    return NextResponse.json({
      success: true,
      message: 'Settlement statement processed',
      report_id: report.id,
      summary: {
        total_transactions: transactions.length,
        matched: matchedCount,
        unmatched: unmatchedCount,
        exceptions: exceptions.length,
      },
      next_step: unmatchedCount > 0 
        ? 'Review and resolve unmatched transactions' 
        : 'All transactions matched successfully',
    }, { status: 200 });

  } catch (error) {
    console.error('Error in import statement API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

