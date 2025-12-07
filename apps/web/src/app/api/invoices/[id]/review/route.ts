import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/invoices/[id]/review
 * Review and approve/reject invoice
 * Roles: BILLING_SPECIALIST, FINANCE_MANAGER, SUPER_ADMIN
 */
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

    // Get user profile with role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, workshop_id, roles!inner(role_code, role_name)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;

    // Verify user has review permissions
    const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'BILLING_SPECIALIST', 'FINANCE_MANAGER'];
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ 
        error: 'Forbidden: Insufficient permissions',
        required_roles: allowedRoles,
        current_role: roleCode
      }, { status: 403 });
    }

    const invoiceId = params.id;
    const body = await request.json();
    
    const {
      review_status,  // APPROVED, REJECTED, PENDING
      review_notes,
      items_verified = false,
      taxes_verified = false,
      customer_details_verified = false,
      send_back_to = null, // For rejections: WORKSHOP_ADMIN, BILLING, etc.
      rejection_reason = null
    } = body;

    // Validate required fields
    if (!review_status || !['APPROVED', 'REJECTED', 'PENDING'].includes(review_status)) {
      return NextResponse.json({ 
        error: 'Invalid review_status. Must be APPROVED, REJECTED, or PENDING' 
      }, { status: 400 });
    }

    if (review_status === 'REJECTED' && !rejection_reason) {
      return NextResponse.json({ 
        error: 'rejection_reason is required when rejecting' 
      }, { status: 400 });
    }

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        lead:service_leads!inner(
          id, lead_number, customer_name, workshop_id
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check if invoice is in reviewable status
    if (!['GENERATED', 'PENDING'].includes(invoice.status)) {
      return NextResponse.json({ 
        error: 'Invoice cannot be reviewed',
        current_status: invoice.status,
        message: 'Only GENERATED or PENDING invoices can be reviewed'
      }, { status: 400 });
    }

    // Check if second approval is required (for high-value invoices)
    const requiresSecondApproval = invoice.requires_second_approval || 
                                   invoice.total_amount > (invoice.second_approval_threshold || 50000);

    let finalStatus = 'GENERATED';
    let secondApprovalRequired = false;

    if (review_status === 'APPROVED') {
      // Check if this is first or second approval
      if (requiresSecondApproval && !invoice.invoice_approved) {
        // First approval - mark as approved but pending second approval
        finalStatus = 'PENDING'; // Still pending second approval
        secondApprovalRequired = true;
      } else if (requiresSecondApproval && invoice.invoice_approved && roleCode === 'FINANCE_MANAGER') {
        // Second approval by Finance Manager
        finalStatus = 'APPROVED';
        secondApprovalRequired = false;
      } else if (!requiresSecondApproval) {
        // No second approval needed
        finalStatus = 'APPROVED';
        secondApprovalRequired = false;
      } else {
        return NextResponse.json({ 
          error: 'This invoice requires Finance Manager approval',
          requires_second_approval: true,
          current_approver: roleCode
        }, { status: 403 });
      }
    } else if (review_status === 'REJECTED') {
      finalStatus = 'DRAFT'; // Send back to draft for correction
    }

    const now = new Date().toISOString();

    // Create invoice_reviews record
    const { data: reviewRecord, error: reviewInsertError } = await supabase
      .from('invoice_reviews')
      .insert({
        invoice_id: invoiceId,
        reviewed_by: user.id,
        review_status,
        review_notes,
        items_verified,
        taxes_verified,
        customer_details_verified,
        reviewed_at: now
      })
      .select()
      .single();

    if (reviewInsertError) {
      console.error('Error creating review record:', reviewInsertError);
      return NextResponse.json({ 
        error: 'Failed to create review record',
        details: reviewInsertError.message
      }, { status: 500 });
    }

    // Update invoice status
    const updateData: any = {
      status: finalStatus,
      updated_at: now
    };

    if (review_status === 'APPROVED') {
      if (!invoice.invoice_approved) {
        // First approval
        updateData.invoice_approved = true;
        updateData.invoice_approved_by = user.id;
        updateData.invoice_approved_at = now;
      } else if (requiresSecondApproval && roleCode === 'FINANCE_MANAGER') {
        // Second approval
        updateData.second_approver_id = user.id;
        updateData.second_approved_at = now;
      }
    } else if (review_status === 'REJECTED') {
      updateData.invoice_approved = false;
      updateData.invoice_approved_by = null;
      updateData.invoice_approved_at = null;
    }

    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating invoice:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update invoice',
        details: updateError.message
      }, { status: 500 });
    }

    // Create finance_event
    await createFinanceEvent({
      event_type: review_status === 'APPROVED' ? 'invoice_approved' : 'invoice_rejected',
      entity_type: 'invoice',
      entity_id: invoiceId,
      actor_id: user.id,
      actor_role: roleCode,
      event_data: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        lead_id: invoice.lead_id,
        lead_number: (invoice.lead as any)?.lead_number,
        review_status,
        review_notes,
        items_verified,
        taxes_verified,
        customer_details_verified,
        requires_second_approval: secondApprovalRequired,
        rejection_reason,
        send_back_to,
        amount: invoice.total_amount,
        reviewer: (userProfile.roles as any)?.role_name
      }
    });

    // Create lead_event for audit trail
    await supabase
      .from('lead_events')
      .insert({
        lead_id: invoice.lead_id,
        event_type: review_status === 'APPROVED' ? 'invoice_approved' : 'invoice_rejected',
        event_description: review_status === 'APPROVED' 
          ? `Invoice ${invoice.invoice_number} approved by ${(userProfile.roles as any)?.role_name}`
          : `Invoice ${invoice.invoice_number} rejected: ${rejection_reason}`,
        event_data: {
          invoice_id: invoiceId,
          reviewer_id: user.id,
          review_status,
          review_notes
        },
        actor_id: user.id,
        actor_role: roleCode
      });

    // TODO: Send notification to relevant parties
    // - If approved and sent to customer, notify customer
    // - If rejected, notify workshop admin or billing team
    // - If requires second approval, notify Finance Manager

    return NextResponse.json({
      success: true,
      message: review_status === 'APPROVED' 
        ? (secondApprovalRequired 
          ? 'Invoice approved. Awaiting Finance Manager second approval.'
          : 'Invoice approved successfully!')
        : 'Invoice rejected. Sent back for corrections.',
      invoice: updatedInvoice,
      review: reviewRecord,
      requires_second_approval: secondApprovalRequired,
      next_action: review_status === 'APPROVED' && !secondApprovalRequired
        ? 'ready_to_send_to_customer'
        : review_status === 'APPROVED' && secondApprovalRequired
        ? 'pending_finance_manager_approval'
        : 'corrections_required'
    });

  } catch (error: any) {
    console.error('Error reviewing invoice:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/invoices/[id]/review
 * Get review history for an invoice
 */
export async function GET(
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

    const invoiceId = params.id;

    // Get invoice review history
    const { data: reviews, error: reviewsError } = await supabase
      .from('invoice_reviews')
      .select(`
        *,
        reviewer:users_login!reviewed_by(
          id, full_name, email,
          role:roles(role_code, role_name)
        )
      `)
      .eq('invoice_id', invoiceId)
      .order('reviewed_at', { ascending: false });

    if (reviewsError) {
      console.error('Error fetching review history:', reviewsError);
      return NextResponse.json({ 
        error: 'Failed to fetch review history',
        details: reviewsError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      reviews: reviews || []
    });

  } catch (error: any) {
    console.error('Error fetching review history:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

