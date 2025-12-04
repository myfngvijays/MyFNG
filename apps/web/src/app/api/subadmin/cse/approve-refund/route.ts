/**
 * CSE Sub Admin Refund Approval API
 * POST /api/subadmin/cse/approve-refund
 * Approve or reject refund requests
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/subadmin/cse/approve-refund
 * Approve refund request
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, department, full_name, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const department = userProfile.department;

    if (roleCode !== 'SUB_ADMIN' || department !== 'CSE') {
      return NextResponse.json({ error: 'Forbidden: CSE Sub Admin role required' }, { status: 403 });
    }

    const body = await request.json();
    const { refund_id, action, approval_notes, rejection_reason } = body;

    if (!refund_id || !action) {
      return NextResponse.json(
        { error: 'refund_id and action (APPROVE/REJECT) are required' },
        { status: 400 }
      );
    }

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be APPROVE or REJECT' },
        { status: 400 }
      );
    }

    // Get refund request
    const { data: refundRequest, error: refundError } = await supabase
      .from('refund_requests')
      .select('*')
      .eq('id', refund_id)
      .single();

    if (refundError || !refundRequest) {
      return NextResponse.json({ error: 'Refund request not found' }, { status: 404 });
    }

    if (refundRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Refund request is already ${refundRequest.status}` },
        { status: 400 }
      );
    }

    if (action === 'APPROVE') {
      // Approve refund
      const { data: updatedRefund, error: updateError } = await supabase
        .from('refund_requests')
        .update({
          status: 'APPROVED',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          approval_notes: approval_notes || `Approved by CSE Sub Admin: ${userProfile.full_name}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', refund_id)
        .select()
        .single();

      if (updateError || !updatedRefund) {
        console.error('Error approving refund:', updateError);
        return NextResponse.json(
          { error: 'Failed to approve refund', details: updateError?.message },
          { status: 500 }
        );
      }

      // Update related complaint if exists
      if (refundRequest.complaint_id) {
        await supabase
          .from('customer_complaints')
          .update({
            refund_issued: true,
            refund_amount: refundRequest.amount,
            refund_reference: refundRequest.refund_reference || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', refundRequest.complaint_id);
      }

      // Log action
      await supabase.from('subadmin_actions').insert({
        subadmin_id: user.id,
        department: 'CSE',
        action_type: 'APPROVE_REFUND',
        action_description: `Approved refund request ${refund_id} for amount ₹${refundRequest.amount}`,
        related_entity_type: 'REFUND',
        related_entity_id: refund_id,
        old_status: 'PENDING',
        new_status: 'APPROVED',
        metadata: {
          refund_amount: refundRequest.amount,
          approval_notes: approval_notes || null,
        },
      });

      return NextResponse.json({
        success: true,
        refund: updatedRefund,
        message: 'Refund approved successfully',
      });

    } else {
      // Reject refund
      if (!rejection_reason) {
        return NextResponse.json(
          { error: 'rejection_reason is required for REJECT action' },
          { status: 400 }
        );
      }

      const { data: updatedRefund, error: updateError } = await supabase
        .from('refund_requests')
        .update({
          status: 'REJECTED',
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejection_reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', refund_id)
        .select()
        .single();

      if (updateError || !updatedRefund) {
        console.error('Error rejecting refund:', updateError);
        return NextResponse.json(
          { error: 'Failed to reject refund', details: updateError?.message },
          { status: 500 }
        );
      }

      // Log action
      await supabase.from('subadmin_actions').insert({
        subadmin_id: user.id,
        department: 'CSE',
        action_type: 'REJECT_REFUND',
        action_description: `Rejected refund request ${refund_id}`,
        related_entity_type: 'REFUND',
        related_entity_id: refund_id,
        old_status: 'PENDING',
        new_status: 'REJECTED',
        metadata: {
          rejection_reason: rejection_reason,
        },
      });

      return NextResponse.json({
        success: true,
        refund: updatedRefund,
        message: 'Refund rejected',
      });
    }

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/cse/approve-refund:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

