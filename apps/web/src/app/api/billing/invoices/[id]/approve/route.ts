/**
 * Invoice Approval API
 * Step 4: Invoice Review - Approve invoice after verification
 */

import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClientFromRequest(request);
    
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

    // Verify user has billing permissions
    const allowedRoles = ['super_admin', 'sub_admin', 'workshop_admin'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
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

    // Prevent edits after archival/closure
    if ((invoice.lead as any)?.read_only) {
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
    }

    // Verify invoice is in GENERATED status
    if (invoice.status !== 'GENERATED') {
      return NextResponse.json({ 
        error: 'Invoice cannot be approved',
        current_status: invoice.status,
        hint: 'Only GENERATED invoices can be approved'
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const body = await request.json();
    const { review_notes, items_verified, taxes_verified, customer_details_verified, skip_validation } = body;

    // Check if this is second approval (Finance Manager)
    const isSecondApproval = invoice.requires_second_approval && 
                              invoice.invoice_approved && 
                              invoice.invoice_approved_by !== userProfile.id;

    // If not second approval, check threshold for second approval requirement
    const threshold = parseFloat(invoice.second_approval_threshold || '50000');
    const requiresSecondApproval = !isSecondApproval && parseFloat(invoice.final_amount || '0') > threshold;

    // Run validation if not skipped (only for first approval)
    if (!skip_validation && !isSecondApproval) {
      const validationResponse = await fetch(
        `${request.nextUrl.origin}/api/billing/invoices/${invoiceId}/validate`,
        { method: 'GET' }
      );
      
      if (validationResponse.ok) {
        const validationData = await validationResponse.json();
        if (!validationData.validation?.valid) {
          return NextResponse.json({
            error: 'Invoice validation failed',
            validation: validationData.validation,
            hint: 'Please fix the issues before approving'
          }, { status: 400 });
        }
      }
    }

    // Update invoice
    const updateData: any = {
      invoice_approved: true,
      invoice_approved_by: userProfile.id,
      invoice_approved_at: now,
      updated_at: now,
    };

    if (isSecondApproval) {
      // Second approval - mark as fully approved
      updateData.second_approver_id = userProfile.id;
      updateData.second_approved_at = now;
      updateData.status = 'APPROVED';
    } else if (requiresSecondApproval) {
      // First approval but requires second approval
      updateData.requires_second_approval = true;
      updateData.status = 'PENDING_SECOND_APPROVAL';
    } else {
      // First approval and no second approval needed
      updateData.status = 'APPROVED';
    }

    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) {
      console.error('Error approving invoice:', updateError);
      return NextResponse.json({ error: 'Failed to approve invoice' }, { status: 500 });
    }

    // Create invoice review record
    await supabase
      .from('invoice_reviews')
      .insert({
        invoice_id: invoiceId,
        reviewed_by: userProfile.id,
        review_status: isSecondApproval ? 'SECOND_APPROVED' : 'APPROVED',
        review_notes: review_notes || (isSecondApproval ? 'Second approval by Finance Manager' : 'Invoice approved after verification'),
        items_verified: items_verified ?? true,
        taxes_verified: taxes_verified ?? true,
        customer_details_verified: customer_details_verified ?? true,
        reviewed_at: now,
      });

    // Create finance event
    await createFinanceEvent({
      eventType: isSecondApproval ? 'invoice_approved' : 'invoice_approved',
      entityType: 'invoice',
      entityId: invoiceId,
      actorId: userProfile.id,
      actorRole: userProfile.role,
      actorName: userProfile.name,
      eventData: {
        invoice_number: invoice.invoice_number,
        final_amount: invoice.final_amount,
        is_second_approval: isSecondApproval,
        requires_second_approval: requiresSecondApproval,
        review_notes: review_notes,
        items_verified: items_verified,
        taxes_verified: taxes_verified,
        customer_details_verified: customer_details_verified,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // Update lead status to AWAITING_PAYMENT (only if fully approved)
    if (invoice.lead_id && updatedInvoice.status === 'APPROVED') {
      await supabase
        .from('service_leads')
        .update({
          status: 'AWAITING_PAYMENT',
          updated_at: now,
        })
        .eq('id', invoice.lead_id);

      // Best-effort: persist invoice document to storage after approval (so sharing has stable URL)
      try {
        await fetch(`${request.nextUrl.origin}/api/billing/invoices/${invoiceId}/persist-document`, {
          method: 'POST',
        });
      } catch {
        // non-fatal
      }

      // Log status change
      await supabase
        .from('lead_status_history')
        .insert({
          lead_id: invoice.lead_id,
          old_status: 'INVOICE_GENERATED',
          new_status: 'AWAITING_PAYMENT',
          changed_by: userProfile.id,
          changed_at: now,
          reason: 'Invoice approved and ready for payment',
          notes: `Invoice ${invoice.invoice_number} approved by ${userProfile.name || userProfile.email}`,
        });

      // Create activity log
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: invoice.lead_id,
          user_id: userProfile.id,
          activity_type: 'INVOICE_APPROVED',
          description: `Invoice ${invoice.invoice_number} approved`,
          old_status: 'INVOICE_GENERATED',
          new_status: 'AWAITING_PAYMENT',
          metadata: {
            invoice_id: invoiceId,
            invoice_number: invoice.invoice_number,
            approved_by: userProfile.id,
            approved_at: now,
            review_notes: review_notes,
          },
        });
    }

    return NextResponse.json({
      success: true,
      message: isSecondApproval 
        ? 'Invoice second approval completed successfully' 
        : requiresSecondApproval
        ? 'Invoice approved. Awaiting Finance Manager second approval.'
        : 'Invoice approved successfully',
      invoice: updatedInvoice,
      is_second_approval: isSecondApproval,
      requires_second_approval: requiresSecondApproval,
      next_step: updatedInvoice.status === 'APPROVED' 
        ? 'Send invoice to customer and await payment'
        : 'Awaiting Finance Manager second approval',
    }, { status: 200 });

  } catch (error) {
    console.error('Error in approve invoice API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

