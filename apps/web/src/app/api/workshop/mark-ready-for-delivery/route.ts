/**
 * Mark Vehicle Ready for Delivery API
 * Step 8: Vehicle Delivery - Manual trigger after payment
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
      .select('id, role, name, email, workshop_id')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user has permissions
    const allowedRoles = ['workshop_admin', 'super_admin', 'sub_admin'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*, invoice:invoices!invoice_id(*)')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Verify lead is from this workshop
    if (lead.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Lead not in your workshop' }, { status: 403 });
    }

    // Verify payment is completed
    const invoice = lead.invoice;
    if (!invoice || invoice.payment_status !== 'PAID') {
      return NextResponse.json({ 
        error: 'Payment must be completed before marking ready for delivery',
        payment_status: invoice?.payment_status || 'NO_INVOICE'
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update lead status to READY_FOR_DELIVERY
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        status: 'READY_FOR_DELIVERY',
        ready_for_delivery_at: now,
        marked_ready_by: userProfile.id,
        updated_at: now,
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating lead:', updateError);
      return NextResponse.json({ error: 'Failed to mark ready for delivery' }, { status: 500 });
    }

    // Log status change
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'READY_FOR_DELIVERY',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Vehicle ready for delivery after payment',
        notes: `Payment completed. Vehicle ready for delivery.`,
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'READY_FOR_DELIVERY',
        description: 'Vehicle marked ready for delivery',
        old_status: lead.status,
        new_status: 'READY_FOR_DELIVERY',
        metadata: {
          marked_by: userProfile.id,
          marked_at: now,
          payment_status: invoice.payment_status,
          invoice_number: invoice.invoice_number,
        },
      });

    // TODO: Send notification to pickup boy (if delivery service)
    // TODO: Send notification to customer

    return NextResponse.json({
      success: true,
      message: 'Vehicle marked ready for delivery',
      lead: updatedLead,
      next_step: 'Assign delivery to pickup boy (if delivery service required)',
    }, { status: 200 });

  } catch (error) {
    console.error('Error in mark ready for delivery API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

