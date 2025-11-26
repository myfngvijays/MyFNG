/**
 * Invoice Approval API
 * Step 4: Invoice Review - Approve invoice after verification
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
    const { review_notes, items_verified, taxes_verified, customer_details_verified } = body;

    // Update invoice
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update({
        invoice_approved: true,
        invoice_approved_by: userProfile.id,
        invoice_approved_at: now,
        status: 'APPROVED',
        updated_at: now,
      })
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
        review_status: 'APPROVED',
        review_notes: review_notes || 'Invoice approved after verification',
        items_verified: items_verified ?? true,
        taxes_verified: taxes_verified ?? true,
        customer_details_verified: customer_details_verified ?? true,
        reviewed_at: now,
      });

    // Update lead status to AWAITING_PAYMENT
    if (invoice.lead_id) {
      await supabase
        .from('service_leads')
        .update({
          status: 'AWAITING_PAYMENT',
          updated_at: now,
        })
        .eq('id', invoice.lead_id);

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
      message: 'Invoice approved successfully',
      invoice: updatedInvoice,
      next_step: 'Send invoice to customer and await payment',
    }, { status: 200 });

  } catch (error) {
    console.error('Error in approve invoice API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

