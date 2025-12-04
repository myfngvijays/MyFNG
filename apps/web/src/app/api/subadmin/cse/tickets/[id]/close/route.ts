/**
 * CSE Sub Admin Ticket Close API
 * POST /api/subadmin/cse/tickets/[id]/close
 * Close ticket with resolution
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
      .select('id, department, full_name, roles!inner(role_code)')
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
    const { resolution, resolution_action_taken, customer_satisfied, customer_feedback } = body;

    if (!resolution) {
      return NextResponse.json({ error: 'resolution is required' }, { status: 400 });
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

    // Close ticket
    const { data: updatedTicket, error: updateError } = await supabase
      .from('customer_complaints')
      .update({
        status: 'CLOSED',
        resolution: resolution,
        resolution_action_taken: resolution_action_taken || null,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        closed_by: user.id,
        closed_at: new Date().toISOString(),
        customer_satisfied: customer_satisfied || null,
        customer_feedback: customer_feedback || null,
        closure_notes: `Closed by Sub Admin: ${userProfile.full_name}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (updateError || !updatedTicket) {
      console.error('Error closing ticket:', updateError);
      return NextResponse.json(
        { error: 'Failed to close ticket', details: updateError?.message },
        { status: 500 }
      );
    }

    // Log action
    await supabase.from('subadmin_actions').insert({
      subadmin_id: user.id,
      department: 'CSE',
      action_type: 'CLOSE_TICKET',
      action_description: `Closed ticket ${ticketId} with resolution`,
      related_entity_type: 'TICKET',
      related_entity_id: ticketId,
      old_status: currentTicket.status,
      new_status: 'CLOSED',
      metadata: {
        resolution: resolution,
        resolution_action_taken: resolution_action_taken || null,
        customer_satisfied: customer_satisfied || null,
      },
    });

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      message: 'Ticket closed successfully',
    });

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/cse/tickets/[id]/close:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

