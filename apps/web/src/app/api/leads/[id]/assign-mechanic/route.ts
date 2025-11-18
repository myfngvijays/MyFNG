import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/leads/[id]/assign-mechanic
 * 
 * Assign a mechanic to a lead (Supervisor action)
 * 
 * Body:
 * - mechanic_id: UUID of the mechanic to assign
 * - notes: Optional assignment notes
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    
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
    const { mechanic_id, notes } = await request.json();

    if (!mechanic_id) {
      return NextResponse.json({ error: 'mechanic_id is required' }, { status: 400 });
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

    // Verify mechanic belongs to same workshop
    const { data: mechanic, error: mechanicError } = await supabase
      .from('users_login')
      .select('id, workshop_id, full_name, roles!inner(role_code)')
      .eq('id', mechanic_id)
      .single();

    if (mechanicError || !mechanic) {
      return NextResponse.json({ error: 'Mechanic not found' }, { status: 404 });
    }

    if ((mechanic.roles as any)?.role_code !== 'WORKSHOP_MECHANIC') {
      return NextResponse.json({ error: 'User is not a mechanic' }, { status: 400 });
    }

    if (mechanic.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Mechanic belongs to different workshop' }, { status: 400 });
    }

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
      return NextResponse.json({ error: 'Failed to assign mechanic' }, { status: 500 });
    }

    // Create mechanic assignment record
    const { error: assignmentError } = await supabase
      .from('mechanic_assignments')
      .insert({
        lead_id: leadId,
        mechanic_id: mechanic_id,
        assigned_by: user.id,
        assignment_notes: notes,
        status: 'ACTIVE'
      });

    if (assignmentError) {
      console.error('Error creating assignment record:', assignmentError);
      // Continue anyway, main update succeeded
    }

    // Log activity
    await supabase.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'MECHANIC_ASSIGNED',
      event_description: `Mechanic ${mechanic.full_name} assigned by supervisor`,
      created_by: user.id
    });

    return NextResponse.json({
      success: true,
      message: 'Mechanic assigned successfully',
      data: {
        leadId,
        mechanicId: mechanic_id,
        mechanicName: mechanic.full_name
      }
    });

  } catch (error: any) {
    console.error('Assign mechanic API error:', error);
    return NextResponse.json(
      { error: 'Failed to assign mechanic', details: error.message },
      { status: 500 }
    );
  }
}

