/**
 * Telecaller Sub Admin Lead Assignment API
 * POST /api/subadmin/telecaller/leads/[id]/assign
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyTelecallerAssignedToLead } from '@/lib/notifications';

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
      .select('id, department, full_name, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const department = userProfile.department;

    if (roleCode !== 'SUB_ADMIN' || department !== 'TELECALLER') {
      return NextResponse.json({ error: 'Forbidden: Telecaller Sub Admin role required' }, { status: 403 });
    }

    const leadId = params.id;
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
      .eq('department', 'TELECALLER')
      .eq('is_active', true)
      .single();

    if (!teamAssignment) {
      return NextResponse.json(
        { error: 'User is not assigned to your Telecaller team' },
        { status: 403 }
      );
    }

    // Get current lead
    const { data: currentLead } = await supabase
      .from('service_leads')
      .select('id, lead_number, status, assigned_telecaller_id')
      .eq('id', leadId)
      .single();

    if (!currentLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Assign lead
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        assigned_telecaller_id: assign_to_id,
        telecaller_assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError || !updatedLead) {
      console.error('Error assigning lead:', updateError);
      return NextResponse.json(
        { error: 'Failed to assign lead', details: updateError?.message },
        { status: 500 }
      );
    }

    // In-app notification to assigned telecaller (Phase A)
    try {
      const isReassignment =
        Boolean(currentLead?.assigned_telecaller_id) &&
        String(currentLead.assigned_telecaller_id) !== String(assign_to_id);

      await notifyTelecallerAssignedToLead({
        leadId,
        leadNumber: currentLead?.lead_number || leadId,
        telecallerId: assign_to_id,
        assignedByName: userProfile.full_name || undefined,
        isReassignment,
        notes: notes || undefined,
      });
    } catch (e) {
      console.warn('Telecaller assignment notification failed (non-blocking):', e);
    }

    // Log action
    await supabase.from('subadmin_actions').insert({
      subadmin_id: user.id,
      department: 'TELECALLER',
      action_type: 'ASSIGN_LEAD',
      action_description: `Assigned lead ${leadId} to Telecaller ${assign_to_id}`,
      related_entity_type: 'LEAD',
      related_entity_id: leadId,
      old_status: currentLead.status,
      new_status: updatedLead.status,
      metadata: {
        assigned_to: assign_to_id,
        notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      message: 'Lead assigned successfully',
    });

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/telecaller/leads/[id]/assign:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

