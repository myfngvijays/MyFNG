/**
 * Approve Refund API
 * Phase 3 - Step 10: Handle Refunds
 * Purpose: Approve refund request (auto-approve for small amounts)
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';

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
      .select('id, role, name')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user has refund approval permissions
    const allowedRoles = ['super_admin', 'sub_admin', 'finance_manager', 'accounts'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const refundId = params.id;
    const body = await request.json();
    const { approval_notes } = body;

    // Get refund details
    const { data: refund, error: refundError } = await supabase
      .from('refund_requests')
      .select(`
        *,
        invoice:invoices!invoice_id(
          id,
          invoice_number,
          final_amount,
          payment_status,
          payment_transactions(
            id,
            payment_method,
            gateway_payment_id,
            transaction_id
          )
        )
      `)
      .eq('id', refundId)
      .single();

    if (refundError || !refund) {
      return NextResponse.json({ error: 'Refund request not found' }, { status: 404 });
    }

    if (refund.status !== 'PENDING') {
      return NextResponse.json({
        error: 'Refund cannot be approved',
        current_status: refund.status,
      }, { status: 400 });
    }

    // Check auto-approval limit (default ₹5000)
    const autoApproveLimit = 5000;
    const refundAmount = parseFloat(refund.refund_amount || '0');
    const requiresManagerApproval = refundAmount > autoApproveLimit && userProfile.role !== 'finance_manager' && userProfile.role !== 'super_admin';

    if (requiresManagerApproval) {
      return NextResponse.json({
        error: 'Refund requires Finance Manager approval',
        refund_amount: refundAmount,
        auto_approve_limit: autoApproveLimit,
        hint: 'Only Finance Manager or Super Admin can approve refunds above limit',
      }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Update refund status
    const { data: updatedRefund, error: updateError } = await supabase
      .from('refund_requests')
      .update({
        status: 'APPROVED',
        approved_by: userProfile.id,
        approved_at: now,
        approval_notes: approval_notes || 'Refund approved',
        updated_at: now,
      })
      .eq('id', refundId)
      .select()
      .single();

    if (updateError) {
      console.error('Error approving refund:', updateError);
      return NextResponse.json({ error: 'Failed to approve refund' }, { status: 500 });
    }

    // Create finance event
    await createFinanceEvent({
      eventType: 'refund_approved',
      entityType: 'refund',
      entityId: refundId,
      actorId: userProfile.id,
      actorRole: userProfile.role,
      actorName: userProfile.name,
      eventData: {
        refund_number: refund.refund_number,
        refund_amount: refundAmount,
        invoice_id: refund.invoice_id,
        approved_at: now,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Refund approved successfully',
      refund: updatedRefund,
      next_step: 'Process refund via original payment method',
    }, { status: 200 });

  } catch (error) {
    console.error('Error in approve refund API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

