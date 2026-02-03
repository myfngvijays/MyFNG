/**
 * CSE Sub Admin Ticket Reassignment API
 * POST /api/subadmin/cse/tickets/[id]/reassign
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, department, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const department = userProfile.department;

    if (roleCode !== 'SUB_ADMIN' || department !== 'CSE') {
      return NextResponse.json({ error: 'Forbidden: CSE Sub Admin role required' }, { status: 403 });
    }

    const ticketId = params.id;
    const body = await request.json();
    const { new_assign_to_id, reason } = body;

    if (!new_assign_to_id) {
      return NextResponse.json({ error: 'new_assign_to_id is required' }, { status: 400 });
    }

    // Verify new_assign_to is a team member
    const { data: teamAssignment } = await supabase
      .from('subadmin_team_assignments')
      .select('team_member_id')
      .eq('subadmin_id', user.id)
      .eq('team_member_id', new_assign_to_id)
      .eq('department', 'CSE')
      .eq('is_active', true)
      .single();

    if (!teamAssignment) {
      return NextResponse.json(
        { error: 'User is not assigned to your CSE team' },
        { status: 403 }
      );
    }

    // Get current ticket
    const { data: currentTicket } = await supabase
      .from('customer_complaints')
      .select('id, status, assigned_to')
      .eq('id', ticketId)
      .single();

    if (!currentTicket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const oldAssignedTo = currentTicket.assigned_to;

    // Reassign ticket
    const { data: updatedTicket, error: updateError } = await supabase
      .from('customer_complaints')
      .update({
        assigned_to: new_assign_to_id,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (updateError || !updatedTicket) {
      console.error('Error reassigning ticket:', updateError);
      return NextResponse.json(
        { error: 'Failed to reassign ticket', details: updateError?.message },
        { status: 500 }
      );
    }

    // Log action
    await supabase.from('subadmin_actions').insert({
      subadmin_id: user.id,
      department: 'CSE',
      action_type: 'REASSIGN_TICKET',
      action_description: `Reassigned ticket ${ticketId} from ${oldAssignedTo} to ${new_assign_to_id}`,
      related_entity_type: 'TICKET',
      related_entity_id: ticketId,
      old_status: currentTicket.status,
      new_status: updatedTicket.status,
      metadata: {
        old_assigned_to: oldAssignedTo,
        new_assigned_to: new_assign_to_id,
        reason: reason || null,
      },
    });

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      message: 'Ticket reassigned successfully',
    });

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/cse/tickets/[id]/reassign:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

