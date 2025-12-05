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
      .select('id, role_id, workshop_id')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      console.error('User profile error:', profileError);
      return NextResponse.json({ error: 'User profile not found', details: profileError?.message }, { status: 404 });
    }

    // Get role details
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('role_code')
      .eq('id', userProfile.role_id)
      .single();

    if (roleError || !roleData) {
      console.error('Role fetch error:', roleError);
      return NextResponse.json({ error: 'Role not found', details: roleError?.message }, { status: 404 });
    }

    // Verify user is workshop admin or supervisor
    const roleCode = roleData.role_code;
    const isWorkshopAdmin = roleCode === 'WORKSHOP_ADMIN';
    const isSupervisor = roleCode === 'WORKSHOP_SUPERVISOR';
    
    if (!isWorkshopAdmin && !isSupervisor) {
      return NextResponse.json({ error: 'Forbidden: Workshop Admin or Supervisor only', roleCode }, { status: 403 });
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

    // Verify lead is assigned to this workshop
    if (lead.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Lead not assigned to your workshop' }, { status: 403 });
    }

    // Verify lead is in correct status
    if (lead.status !== 'ASSIGNED_TO_WORKSHOP' && lead.status !== 'PENDING') {
      return NextResponse.json({ 
        error: 'Lead cannot be accepted in current status',
        current_status: lead.status 
      }, { status: 400 });
    }

    // Prepare update payload
    const now = new Date().toISOString();
    const updatePayload: any = {
      status: 'ACCEPTED',
      accepted_at: now,
      workshop_accepted_by: userProfile.id,
      updated_at: now
    };

    // If supervisor accepts, auto-assign them as supervisor
    if (isSupervisor) {
      updatePayload.assigned_supervisor_id = userProfile.id;
      updatePayload.supervisor_assigned_at = now;
    }

    // Update lead status to ACCEPTED
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update(updatePayload)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error accepting lead:', updateError);
      return NextResponse.json({ error: 'Failed to accept lead' }, { status: 500 });
    }

    // Log status change in lead_status_history
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'ACCEPTED',
        changed_by: userProfile.id,
        changed_at: new Date().toISOString(),
        reason: isSupervisor ? 'Lead accepted by workshop supervisor' : 'Lead accepted by workshop admin',
        notes: isSupervisor 
          ? 'Workshop supervisor accepted the lead and was auto-assigned as supervisor'
          : 'Workshop has accepted the lead and will assign team members'
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'LEAD_ACCEPTED',
        description: isSupervisor 
          ? 'Workshop supervisor accepted the lead and was auto-assigned'
          : 'Workshop admin accepted the lead',
        old_status: lead.status,
        new_status: 'ACCEPTED',
        metadata: {
          workshop_id: userProfile.workshop_id,
          accepted_by: userProfile.id,
          accepted_at: new Date().toISOString()
        }
      });

    return NextResponse.json({
      success: true,
      message: isSupervisor 
        ? 'Lead accepted successfully. You have been auto-assigned as supervisor.'
        : 'Lead accepted successfully',
      lead: updatedLead,
      next_step: isSupervisor
        ? 'Please assign team members (Mechanic, Pickup Boy)'
        : 'Please assign team members (Mechanic, Supervisor, Pickup Boy)'
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in accept lead API:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message || 'Unknown error occurred' },
      { status: 500 }
    );
  }
}

