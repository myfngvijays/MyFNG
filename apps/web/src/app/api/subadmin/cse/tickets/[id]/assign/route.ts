/**
 * CSE Sub Admin Ticket Assignment API
 * POST /api/subadmin/cse/tickets/[id]/assign
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    const { assign_to_id, notes } = body;

    if (!assign_to_id) {
      return NextResponse.json({ error: 'assign_to_id is required' }, { status: 400 });
    }

    // Verify assign_to is a team member
    const { data: teamAssignment } = await supabase
      .from('subadmin_team_assignments')
      .select('team_member_id')
      .eq('subadmin_id', user.id)
      .eq('team_member_id', assign_to_id)
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

    // Assign ticket
    const { data: updatedTicket, error: updateError } = await supabase
      .from('customer_complaints')
      .update({
        assigned_to: assign_to_id,
        assigned_at: new Date().toISOString(),
        status: currentTicket.status === 'OPEN' ? 'IN_PROGRESS' : currentTicket.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (updateError || !updatedTicket) {
      console.error('Error assigning ticket:', updateError);
      return NextResponse.json(
        { error: 'Failed to assign ticket', details: updateError?.message },
        { status: 500 }
      );
    }

    // Log action
    await supabase.from('subadmin_actions').insert({
      subadmin_id: user.id,
      department: 'CSE',
      action_type: 'ASSIGN_TICKET',
      action_description: `Assigned ticket ${ticketId} to CSE ${assign_to_id}`,
      related_entity_type: 'TICKET',
      related_entity_id: ticketId,
      old_status: currentTicket.status,
      new_status: updatedTicket.status,
      metadata: {
        assigned_to: assign_to_id,
        notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      message: 'Ticket assigned successfully',
    });

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/cse/tickets/[id]/assign:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

