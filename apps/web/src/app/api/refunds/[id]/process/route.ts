/**
 * Process Refund API
 * Phase 3 - Step 10: Handle Refunds
 * Purpose: Process approved refund via original payment method
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
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
      .select('id, role, name')
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

    const refundId = params.id;

    // Get refund details with payment info
    const { data: refund, error: refundError } = await supabase
      .from('refund_requests')
      .select(`
        *,
        invoice:invoices!invoice_id(
          id,
          invoice_number,
          payment_transactions(
            id,
            payment_method,
            payment_gateway,
            gateway_payment_id,
            transaction_id,
            amount
          )
        )
      `)
      .eq('id', refundId)
      .single();

    if (refundError || !refund) {
      return NextResponse.json({ error: 'Refund request not found' }, { status: 404 });
    }

    if (refund.status !== 'APPROVED') {
      return NextResponse.json({
        error: 'Refund must be approved before processing',
        current_status: refund.status,
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const refundAmount = parseFloat(refund.refund_amount || '0');

    // Get original payment transaction
    const originalPayment = refund.invoice?.payment_transactions?.[0];
    if (!originalPayment) {
      return NextResponse.json({
        error: 'Original payment transaction not found',
      }, { status: 404 });
    }

    // Process refund based on payment method
    let refundTxnId: string | null = null;
    let refundStatus = 'PROCESSING';

    if (originalPayment.payment_gateway === 'RAZORPAY' && originalPayment.gateway_payment_id) {
      // Process Razorpay refund
      try {
        const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

        const refundResponse = await fetch(`https://api.razorpay.com/v1/payments/${originalPayment.gateway_payment_id}/refund`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
          },
          body: JSON.stringify({
            amount: Math.round(refundAmount * 100), // Convert to paise
            notes: {
              refund_id: refund.id,
              refund_number: refund.refund_number,
              reason: refund.reason,
            },
          }),
        });

        if (refundResponse.ok) {
          const refundData = await refundResponse.json();
          refundTxnId = refundData.id;
          refundStatus = 'COMPLETED';
        } else {
          refundStatus = 'FAILED';
        }
      } catch (error: any) {
        console.error('Razorpay refund error:', error);
        refundStatus = 'FAILED';
      }
    } else if (originalPayment.payment_method === 'CASH') {
      // Cash refund - mark as completed (manual process)
      refundTxnId = `CASH-REF-${Date.now()}`;
      refundStatus = 'COMPLETED';
    } else {
      // Other methods - manual processing
      refundStatus = 'PROCESSING';
    }

    // Update refund request
    const { data: updatedRefund, error: updateError } = await supabase
      .from('refund_requests')
      .update({
        status: refundStatus,
        refund_txn_id: refundTxnId,
        refund_processed_at: refundStatus === 'COMPLETED' ? now : null,
        processed_by: userProfile.id,
        updated_at: now,
      })
      .eq('id', refundId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating refund:', updateError);
      return NextResponse.json({ error: 'Failed to update refund' }, { status: 500 });
    }

    // Update payment transaction with refund
    if (originalPayment.id) {
      await supabase
        .from('payment_transactions')
        .update({
          refund_amount: refundAmount,
          refund_status: refundStatus,
          refunded_at: refundStatus === 'COMPLETED' ? now : null,
          refund_txn_id: refundTxnId,
        })
        .eq('id', originalPayment.id);
    }

    // Update invoice
    await supabase
      .from('invoices')
      .update({
        refund_status: refundStatus,
        refund_amount: refundAmount,
        refunded_at: refundStatus === 'COMPLETED' ? now : null,
      })
      .eq('id', refund.invoice_id);

    // Create GL reversal entries if refund completed
    if (refundStatus === 'COMPLETED') {
      // Debit: Accounts Receivable (reversal)
      // Credit: Bank/Cash (reversal)
      await supabase
        .from('gl_entries')
        .insert([
          {
            entry_type: 'DEBIT',
            account_type: 'ACCOUNTS_RECEIVABLE',
            account_name: 'ACCOUNTS_RECEIVABLE',
            amount: refundAmount,
            reference_type: 'refund',
            reference_id: refundId,
            reference_number: refund.refund_number,
            description: `Refund reversal for ${refund.refund_number}`,
            posted_at: now,
            posted_by: userProfile.id,
          },
          {
            entry_type: 'CREDIT',
            account_type: originalPayment.payment_method === 'CASH' ? 'CASH' : 'BANK',
            account_name: originalPayment.payment_method === 'CASH' ? 'CASH_ACCOUNT' : 'BANK_ACCOUNT',
            amount: refundAmount,
            reference_type: 'refund',
            reference_id: refundId,
            reference_number: refund.refund_number,
            description: `Refund payment for ${refund.refund_number}`,
            posted_at: now,
            posted_by: userProfile.id,
          },
        ]);
    }

    // Create finance event
    await createFinanceEvent({
      eventType: 'refund_processed',
      entityType: 'refund',
      entityId: refundId,
      actorId: userProfile.id,
      actorRole: userProfile.role,
      actorName: userProfile.name,
      eventData: {
        refund_number: refund.refund_number,
        refund_amount: refundAmount,
        refund_status: refundStatus,
        refund_txn_id: refundTxnId,
        processed_at: now,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: refundStatus === 'COMPLETED' 
        ? 'Refund processed successfully' 
        : 'Refund processing initiated',
      refund: updatedRefund,
      refund_status: refundStatus,
      refund_txn_id: refundTxnId,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in process refund API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

