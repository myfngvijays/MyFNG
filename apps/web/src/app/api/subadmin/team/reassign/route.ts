/**
 * Sub Admin Team Reassignment API
 * POST /api/subadmin/team/reassign
 * Reassign a team member (deactivate old, create new)
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
    const { assignment_id, new_subadmin_id, reason } = body;

    if (!assignment_id) {
      return NextResponse.json({ error: 'assignment_id is required' }, { status: 400 });
    }

    // Get current assignment
    const { data: currentAssignment, error: assignError } = await supabase
      .from('subadmin_team_assignments')
      .select('*')
      .eq('id', assignment_id)
      .eq('subadmin_id', user.id)
      .single();

    if (assignError || !currentAssignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // If new_subadmin_id provided, reassign to another Sub Admin
    if (new_subadmin_id) {
      // Verify new Sub Admin exists and has same department
      const { data: newSubAdmin, error: newSubAdminError } = await supabase
        .from('users_login')
        .select('id, department, roles!inner(role_code)')
        .eq('id', new_subadmin_id)
        .single();

      if (newSubAdminError || !newSubAdmin) {
        return NextResponse.json({ error: 'New Sub Admin not found' }, { status: 404 });
      }

      const newSubAdminRoleCode = (newSubAdmin.roles as any)?.role_code;
      const newSubAdminDept = newSubAdmin.department;

      if (newSubAdminRoleCode !== 'SUB_ADMIN' || newSubAdminDept !== department) {
        return NextResponse.json(
          { error: 'New Sub Admin must have same department' },
          { status: 400 }
        );
      }

      // Deactivate old assignment
      await supabase
        .from('subadmin_team_assignments')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignment_id);

      // Create new assignment
      const { data: newAssignment, error: insertError } = await supabase
        .from('subadmin_team_assignments')
        .insert({
          subadmin_id: new_subadmin_id,
          team_member_id: currentAssignment.team_member_id,
          department: department,
          assigned_by: user.id,
          notes: reason || `Reassigned from previous Sub Admin`,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating new assignment:', insertError);
        return NextResponse.json({ error: 'Failed to reassign team member' }, { status: 500 });
      }

      // Log action
      await supabase.from('subadmin_actions').insert({
        subadmin_id: user.id,
        department: department,
        action_type: 'REASSIGN_TEAM_MEMBER',
        action_description: `Reassigned team member ${currentAssignment.team_member_id} to Sub Admin ${new_subadmin_id}`,
        related_entity_type: 'TEAM_ASSIGNMENT',
        related_entity_id: assignment_id,
        metadata: { 
          new_assignment_id: newAssignment.id,
          reason: reason || null,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Team member reassigned successfully',
        new_assignment: newAssignment,
      });
    } else {
      // Just deactivate (remove from team)
      const { error: updateError } = await supabase
        .from('subadmin_team_assignments')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignment_id);

      if (updateError) {
        console.error('Error deactivating assignment:', updateError);
        return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 });
      }

      // Log action
      await supabase.from('subadmin_actions').insert({
        subadmin_id: user.id,
        department: department,
        action_type: 'REMOVE_TEAM_MEMBER',
        action_description: `Removed team member ${currentAssignment.team_member_id} from team`,
        related_entity_type: 'TEAM_ASSIGNMENT',
        related_entity_id: assignment_id,
        metadata: { reason: reason || null },
      });

      return NextResponse.json({
        success: true,
        message: 'Team member removed successfully',
      });
    }

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/team/reassign:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

