import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pickup/tasks/[id]/arrived
 * Mark vehicle as arrived at workshop (status: VEHICLE_DROPPED_AT_WORKSHOP)
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
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is pickup boy
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_PICKUP_BOY') {
      return NextResponse.json({ error: 'Forbidden: Pickup Boy only' }, { status: 403 });
    }

    const leadId = params.id;

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Verify task is assigned to this pickup boy
    if (lead.assigned_pickup_boy_id !== userProfile.id) {
      return NextResponse.json({ error: 'Pickup task not assigned to you' }, { status: 403 });
    }

    // Verify pickup is required
    if (!lead.pickup_required) {
      return NextResponse.json({ 
        error: 'Pickup not required for this lead' 
      }, { status: 400 });
    }

    // Prevent overwriting COMPLETED or later statuses
    const protectedStatuses = ['COMPLETED', 'WORK_COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'];
    if (protectedStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: 'Cannot update status - work already completed',
        current_status: lead.status,
        message: 'Mechanic has already completed the work. Status cannot be changed.'
      }, { status: 400 });
    }

    // Verify current status is VEHICLE_IN_TRANSIT
    if (lead.pickup_status !== 'VEHICLE_IN_TRANSIT' && lead.status !== 'VEHICLE_IN_TRANSIT') {
      return NextResponse.json({ 
        error: 'Vehicle must be in transit before marking as arrived',
        current_status: lead.status,
        current_pickup_status: lead.pickup_status
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update service_leads status to VEHICLE_DROPPED_AT_WORKSHOP
    const { error: updateLeadError } = await supabase
      .from('service_leads')
      .update({
        pickup_status: 'VEHICLE_DROPPED_AT_WORKSHOP',
        status: 'VEHICLE_DROPPED_AT_WORKSHOP',
        updated_at: now
      })
      .eq('id', leadId);

    if (updateLeadError) {
      console.error('Error updating lead status:', updateLeadError);
      return NextResponse.json({ 
        error: 'Failed to update lead status', 
        details: updateLeadError.message 
      }, { status: 500 });
    }

    // Update pickup_tracking
    await supabase
      .from('pickup_tracking')
      .update({
        pickup_status: 'VEHICLE_DROPPED_AT_WORKSHOP',
        pickup_arrival_time: now,
        updated_at: now
      })
      .eq('lead_id', leadId);

    // Log status change
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'VEHICLE_DROPPED_AT_WORKSHOP',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Vehicle arrived at workshop',
        notes: 'Pickup boy marked vehicle as arrived at workshop'
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'VEHICLE_ARRIVED_AT_WORKSHOP',
        description: 'Vehicle arrived at workshop',
        old_status: lead.status,
        new_status: 'VEHICLE_DROPPED_AT_WORKSHOP',
        metadata: {
          pickup_boy_id: userProfile.id,
          arrived_at: now
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Vehicle marked as arrived at workshop',
      status: 'VEHICLE_DROPPED_AT_WORKSHOP'
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in arrived API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

