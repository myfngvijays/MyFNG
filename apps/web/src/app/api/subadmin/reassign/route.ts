/**
 * Sub Admin Reassignment API
 * POST /api/subadmin/reassign
 * Reassign ticket/lead/audit to different team member
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
    const { entity_type, entity_id, new_assign_to_id, reason } = body;

    if (!entity_type || !entity_id || !new_assign_to_id) {
      return NextResponse.json(
        { error: 'entity_type, entity_id, and new_assign_to_id are required' },
        { status: 400 }
      );
    }

    // Verify new_assign_to is a team member
    const { data: teamAssignment } = await supabase
      .from('subadmin_team_assignments')
      .select('team_member_id')
      .eq('subadmin_id', user.id)
      .eq('team_member_id', new_assign_to_id)
      .eq('department', department)
      .eq('is_active', true)
      .single();

    if (!teamAssignment) {
      return NextResponse.json(
        { error: 'User is not assigned to your team' },
        { status: 403 }
      );
    }

    let oldAssignedTo: string | null = null;
    let updateResult: any = null;
    let updateError: any = null;

    if (department === 'CSE' && entity_type === 'TICKET') {
      // Get current assignment
      const { data: current } = await supabase
        .from('customer_complaints')
        .select('assigned_to, status')
        .eq('id', entity_id)
        .single();

      oldAssignedTo = current?.assigned_to || null;

      // Reassign complaint/ticket
      const { data, error } = await supabase
        .from('customer_complaints')
        .update({
          assigned_to: new_assign_to_id,
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', entity_id)
        .select()
        .single();

      updateResult = data;
      updateError = error;

    } else if (department === 'TELECALLER' && entity_type === 'LEAD') {
      // Get current assignment
      const { data: current } = await supabase
        .from('service_leads')
        .select('assigned_telecaller_id, status')
        .eq('id', entity_id)
        .single();

      oldAssignedTo = current?.assigned_telecaller_id || null;

      // Reassign lead to telecaller
      const { data, error } = await supabase
        .from('service_leads')
        .update({
          assigned_telecaller_id: new_assign_to_id,
          telecaller_assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', entity_id)
        .select()
        .single();

      updateResult = data;
      updateError = error;

    } else if (department === 'AUDITOR' && entity_type === 'AUDIT') {
      // Get current assignment
      const { data: current } = await supabase
        .from('workshop_audits')
        .select('auditor_id, audit_status')
        .eq('id', entity_id)
        .single();

      oldAssignedTo = current?.auditor_id || null;

      // Reassign audit to auditor
      const { data, error } = await supabase
        .from('workshop_audits')
        .update({
          auditor_id: new_assign_to_id,
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
      console.error('Error reassigning entity:', updateError);
      return NextResponse.json(
        { error: 'Failed to reassign entity', details: updateError?.message },
        { status: 500 }
      );
    }

    // Log action
    await supabase.from('subadmin_actions').insert({
      subadmin_id: user.id,
      department: department,
      action_type: 'REASSIGN',
      action_description: `Reassigned ${entity_type} ${entity_id} from ${oldAssignedTo} to ${new_assign_to_id}`,
      related_entity_type: entity_type,
      related_entity_id: entity_id,
      old_status: updateResult.status || null,
      new_status: updateResult.status || null,
      metadata: {
        old_assigned_to: oldAssignedTo,
        new_assigned_to: new_assign_to_id,
        reason: reason || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${entity_type} reassigned successfully`,
      entity: updateResult,
    });

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/reassign:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

