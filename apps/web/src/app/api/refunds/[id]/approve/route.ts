import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/refunds/[id]/approve
 * Approve and process refund request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, full_name, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    const allowedRoles = ['SUPER_ADMIN', 'FINANCE_MANAGER'];
    
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const refundId = params.id;
    const body = await request.json();
    const { 
      approval_notes, 
      refund_method = 'ORIGINAL_METHOD',
      process_immediately = true
    } = body;

    // Get refund request
    const { data: refund } = await supabase
      .from('refund_requests')
      .select('*, lead:service_leads!inner(*), invoice:invoices(*)')
      .eq('id', refundId)
      .single();

    if (!refund) {
      return NextResponse.json({ error: 'Refund request not found' }, { status: 404 });
    }

    if (refund.status !== 'PENDING') {
      return NextResponse.json({ 
        error: 'Refund already processed',
        status: refund.status
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Approve refund
    const { data: approvedRefund, error: approveError } = await supabase
      .from('refund_requests')
      .update({
        status: process_immediately ? 'PROCESSING' : 'APPROVED',
        approved_by: user.id,
        approved_at: now,
        approval_notes,
        refund_method
      })
      .eq('id', refundId)
      .select()
      .single();

    if (approveError) {
      return NextResponse.json({ 
        error: 'Failed to approve refund',
        details: approveError.message
      }, { status: 500 });
    }

    // Process refund if requested
    if (process_immediately) {
      // TODO: Integrate with payment gateway refund API
      // For now, mark as completed
      
      const refundTxnId = `REF-${Date.now()}`;
      
      await supabase
        .from('refund_requests')
        .update({
          status: 'COMPLETED',
          refund_date: now,
          refund_reference: refundTxnId
        })
        .eq('id', refundId);

      // Update payment transaction
      const { data: payment } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('invoice_id', refund.invoice_id)
        .eq('status', 'SUCCESS')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (payment) {
        await supabase
          .from('payment_transactions')
          .update({
            refund_status: 'COMPLETED',
            refund_amount: refund.amount,
            refunded_at: now,
            refund_txn_id: refundTxnId
          })
          .eq('id', payment.id);
      }

      // Post GL reversal entries
      await supabase
        .from('gl_entries')
        .insert([
          {
            entry_type: 'CREDIT',
            account_type: 'REVENUE',
            account_name: 'Service Revenue',
            amount: -refund.amount,
            reference_type: 'refund',
            reference_id: refundId,
            reference_number: refundTxnId,
            description: `Refund for lead ${refund.lead?.lead_number}`,
            posted_by: user.id
          },
          {
            entry_type: 'DEBIT',
            account_type: 'LIABILITY',
            account_name: 'Refunds Payable',
            amount: refund.amount,
            reference_type: 'refund',
            reference_id: refundId,
            reference_number: refundTxnId,
            description: `Refund for lead ${refund.lead?.lead_number}`,
            posted_by: user.id
          }
        ]);
    }

    // Create finance event
    await createFinanceEvent({
      eventType: 'refund_approved',
      entityType: 'refund',
      entityId: refundId,
      actorId: user.id,
      actorRole: roleCode,
      actorName: userProfile?.full_name,
      eventData: {
        refund_id: refundId,
        lead_id: refund.lead_id,
        amount: refund.amount,
        refund_method,
        processed: process_immediately
      }
    });

    return NextResponse.json({
      success: true,
      message: process_immediately ? 'Refund approved and processed' : 'Refund approved',
      refund: approvedRefund
    });

  } catch (error: any) {
    console.error('Error approving refund:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
