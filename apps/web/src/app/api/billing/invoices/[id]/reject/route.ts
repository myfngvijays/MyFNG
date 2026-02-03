/**
 * Invoice Rejection API
 * Step 4: Invoice Review - Reject invoice with notes
 */

import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: invoiceId } = await params;
    if (!invoiceId || !isUuid(String(invoiceId))) {
      return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 });
    }

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

    const body = await request.json();
    const { rejection_reason, review_notes } = body;

    if (!rejection_reason) {
      return NextResponse.json({ 
        error: 'Rejection reason is required' 
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Create invoice review record
    await supabase
      .from('invoice_reviews')
      .insert({
        invoice_id: invoiceId,
        reviewed_by: userProfile.id,
        review_status: 'REJECTED',
        review_notes: review_notes || rejection_reason,
        items_verified: false,
        taxes_verified: false,
        customer_details_verified: false,
        reviewed_at: now,
      });

    // Update invoice status (keep it GENERATED but mark as needs revision)
    await supabase
      .from('invoices')
      .update({
        status: 'GENERATED', // Keep as GENERATED but needs revision
        notes: `Rejected: ${rejection_reason}. ${review_notes || ''}`,
        updated_at: now,
      })
      .eq('id', invoiceId);

    // Log activity
    if (invoice.lead_id) {
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: invoice.lead_id,
          user_id: userProfile.id,
          activity_type: 'INVOICE_REJECTED',
          description: `Invoice ${invoice.invoice_number} rejected: ${rejection_reason}`,
          old_status: 'INVOICE_GENERATED',
          new_status: 'INVOICE_GENERATED',
          metadata: {
            invoice_id: invoiceId,
            invoice_number: invoice.invoice_number,
            rejected_by: userProfile.id,
            rejected_at: now,
            rejection_reason: rejection_reason,
            review_notes: review_notes,
          },
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice rejected. Please revise and regenerate.',
      rejection_reason: rejection_reason,
      next_step: 'Revise invoice details and regenerate',
    }, { status: 200 });

  } catch (error) {
    console.error('Error in reject invoice API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

