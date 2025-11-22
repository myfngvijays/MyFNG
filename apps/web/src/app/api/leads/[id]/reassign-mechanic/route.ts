import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/leads/[id]/reassign-mechanic
 * 
 * Reassign a lead to a different mechanic (Supervisor action)
 * 
 * Body:
 * - mechanic_id: UUID of the new mechanic
 * - reason: Reason for reassignment (required)
 * - notes: Optional additional notes
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to verify supervisor role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('role_id, workshop_id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify supervisor role
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_SUPERVISOR') {
      return NextResponse.json({ error: 'Forbidden: Supervisor role required' }, { status: 403 });
    }

    const leadId = params.id;
    const { mechanic_id, reason, notes } = await request.json();

    if (!mechanic_id) {
      return NextResponse.json({ error: 'mechanic_id is required' }, { status: 400 });
    }

    if (!reason || reason.trim() === '') {
      return NextResponse.json({ error: 'reason is required for reassignment' }, { status: 400 });
    }

    // Fetch the lead
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, workshop_id, status, assigned_mechanic_id')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Verify workshop ownership
    if (lead.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Forbidden: Lead belongs to different workshop' }, { status: 403 });
    }

    const previousMechanicId = lead.assigned_mechanic_id;

    if (!previousMechanicId) {
      return NextResponse.json({ error: 'Lead has no mechanic assigned yet' }, { status: 400 });
    }

    if (previousMechanicId === mechanic_id) {
      return NextResponse.json({ error: 'Cannot reassign to the same mechanic' }, { status: 400 });
    }

    // Verify new mechanic
    const { data: newMechanic, error: mechanicError } = await supabase
      .from('users_login')
      .select('id, workshop_id, full_name, roles!inner(role_code)')
      .eq('id', mechanic_id)
      .single();

    if (mechanicError || !newMechanic) {
      return NextResponse.json({ error: 'New mechanic not found' }, { status: 404 });
    }

    if ((newMechanic.roles as any)?.role_code !== 'WORKSHOP_MECHANIC') {
      return NextResponse.json({ error: 'User is not a mechanic' }, { status: 400 });
    }

    if (newMechanic.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Mechanic belongs to different workshop' }, { status: 400 });
    }

    // Get previous mechanic name
    const { data: previousMechanic } = await supabase
      .from('users_login')
      .select('full_name')
      .eq('id', previousMechanicId)
      .single();

    // Update current assignment to REASSIGNED
    await supabase
      .from('mechanic_assignments')
      .update({
        status: 'REASSIGNED',
        updated_at: new Date().toISOString()
      })
      .eq('lead_id', leadId)
      .eq('mechanic_id', previousMechanicId)
      .eq('status', 'ACTIVE');

    // Update the lead
    const { error: updateError } = await supabase
      .from('service_leads')
      .update({
        assigned_mechanic_id: mechanic_id,
        mechanic_assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId);

    if (updateError) {
      console.error('Error updating lead:', updateError);
      return NextResponse.json({ error: 'Failed to reassign mechanic' }, { status: 500 });
    }

    // Create new mechanic assignment record
    const { error: assignmentError } = await supabase
      .from('mechanic_assignments')
      .insert({
        lead_id: leadId,
        mechanic_id: mechanic_id,
        assigned_by: user.id,
        reassigned_from: previousMechanicId,
        reassignment_reason: reason,
        assignment_notes: notes,
        status: 'ACTIVE'
      });

    if (assignmentError) {
      console.error('Error creating assignment record:', assignmentError);
    }

    // Log activity
    await supabase.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'MECHANIC_REASSIGNED',
      event_description: `Mechanic reassigned from ${previousMechanic?.full_name || 'Unknown'} to ${newMechanic.full_name}. Reason: ${reason}`,
      created_by: user.id,
      event_data: {
        previous_mechanic_id: previousMechanicId,
        new_mechanic_id: mechanic_id,
        reason: reason
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Mechanic reassigned successfully',
      data: {
        leadId,
        previousMechanicId,
        newMechanicId: mechanic_id,
        newMechanicName: newMechanic.full_name,
        reason
      }
    });

  } catch (error: any) {
    console.error('Reassign mechanic API error:', error);
    return NextResponse.json(
      { error: 'Failed to reassign mechanic', details: error.message },
      { status: 500 }
    );
  }
}

