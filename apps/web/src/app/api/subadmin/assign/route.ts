/**
 * Sub Admin Assignment API
 * POST /api/subadmin/assign
 * Assign ticket/lead/audit to team member
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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

    if (roleCode !== 'SUB_ADMIN' || !department) {
      return NextResponse.json({ error: 'Forbidden: Sub Admin role required' }, { status: 403 });
    }

    const body = await request.json();
    const { entity_type, entity_id, assign_to_id, notes } = body;

    if (!entity_type || !entity_id || !assign_to_id) {
      return NextResponse.json(
        { error: 'entity_type, entity_id, and assign_to_id are required' },
        { status: 400 }
      );
    }

    // Verify assign_to is a team member
    const { data: teamAssignment } = await supabase
      .from('subadmin_team_assignments')
      .select('team_member_id')
      .eq('subadmin_id', user.id)
      .eq('team_member_id', assign_to_id)
      .eq('department', department)
      .eq('is_active', true)
      .single();

    if (!teamAssignment) {
      return NextResponse.json(
        { error: 'User is not assigned to your team' },
        { status: 403 }
      );
    }

    let updateResult: any = null;
    let updateError: any = null;

    if (department === 'CSE' && entity_type === 'TICKET') {
      // Assign complaint/ticket
      const { data, error } = await supabase
        .from('customer_complaints')
        .update({
          assigned_to: assign_to_id,
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', entity_id)
        .select()
        .single();

      updateResult = data;
      updateError = error;

    } else if (department === 'TELECALLER' && entity_type === 'LEAD') {
      // Assign lead to telecaller
      const { data, error } = await supabase
        .from('service_leads')
        .update({
          assigned_telecaller_id: assign_to_id,
          telecaller_assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', entity_id)
        .select()
        .single();

      updateResult = data;
      updateError = error;

    } else if (department === 'AUDITOR' && entity_type === 'AUDIT') {
      // Assign audit to auditor
      const { data, error } = await supabase
        .from('workshop_audits')
        .update({
          auditor_id: assign_to_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entity_id)
        .select()
        .single();

      updateResult = data;
      updateError = error;

    } else {
      return NextResponse.json(
        { error: `Invalid entity_type for ${department} department` },
        { status: 400 }
      );
    }

    if (updateError || !updateResult) {
      console.error('Error assigning entity:', updateError);
      return NextResponse.json(
        { error: 'Failed to assign entity', details: updateError?.message },
        { status: 500 }
      );
    }

    // Log action
    await supabase.from('subadmin_actions').insert({
      subadmin_id: user.id,
      department: department,
      action_type: 'ASSIGN',
      action_description: `Assigned ${entity_type} ${entity_id} to team member ${assign_to_id}`,
      related_entity_type: entity_type,
      related_entity_id: entity_id,
      old_status: null,
      new_status: updateResult.status || null,
      metadata: {
        assigned_to: assign_to_id,
        notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${entity_type} assigned successfully`,
      entity: updateResult,
    });

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/assign:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

