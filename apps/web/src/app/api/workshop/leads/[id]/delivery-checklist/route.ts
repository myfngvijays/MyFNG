import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workshop/leads/[id]/delivery-checklist
 * Update delivery checklist items for a lead
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

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, workshop_id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user has permissions (workshop supervisor, admin, or sub admin)
    const roleCode = (userProfile.roles as any)?.role_code;
    const allowedRoles = ['WORKSHOP_SUPERVISOR', 'WORKSHOP_ADMIN', 'WORKSHOP_ADVISER', 'SUB_ADMIN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const leadId = params.id;
    const body = await request.json();
    const { 
      delivery_invoice_ready, 
      delivery_car_washed, 
      delivery_paperwork_complete 
    } = body;

    // Validate that at least one field is provided
    if (
      delivery_invoice_ready === undefined &&
      delivery_car_washed === undefined &&
      delivery_paperwork_complete === undefined
    ) {
      return NextResponse.json({ 
        error: 'At least one checklist item must be provided',
        hint: 'Provide delivery_invoice_ready, delivery_car_washed, or delivery_paperwork_complete'
      }, { status: 400 });
    }

    // Get lead details to verify workshop access
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, workshop_id, status')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Verify lead is from this workshop
    if (lead.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Forbidden: Lead not from your workshop' }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: now,
    };

    if (delivery_invoice_ready !== undefined) {
      updateData.delivery_invoice_ready = Boolean(delivery_invoice_ready);
    }
    if (delivery_car_washed !== undefined) {
      updateData.delivery_car_washed = Boolean(delivery_car_washed);
    }
    if (delivery_paperwork_complete !== undefined) {
      updateData.delivery_paperwork_complete = Boolean(delivery_paperwork_complete);
    }

    // Update lead with checklist items
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update(updateData)
      .eq('id', leadId)
      .select('delivery_invoice_ready, delivery_car_washed, delivery_paperwork_complete')
      .single();

    if (updateError) {
      console.error('Error updating delivery checklist:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update delivery checklist', 
        details: updateError.message 
      }, { status: 500 });
    }

    // Create activity log
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: userProfile.id,
      activity_type: 'DELIVERY_CHECKLIST_UPDATED',
      description: 'Delivery checklist updated',
      metadata: {
        delivery_invoice_ready: updatedLead.delivery_invoice_ready,
        delivery_car_washed: updatedLead.delivery_car_washed,
        delivery_paperwork_complete: updatedLead.delivery_paperwork_complete,
        updated_by: userProfile.id,
        updated_at: now,
      },
    } as any);

    return NextResponse.json({
      success: true,
      message: 'Delivery checklist updated successfully',
      checklist: {
        delivery_invoice_ready: updatedLead.delivery_invoice_ready,
        delivery_car_washed: updatedLead.delivery_car_washed,
        delivery_paperwork_complete: updatedLead.delivery_paperwork_complete,
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in delivery checklist API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}
