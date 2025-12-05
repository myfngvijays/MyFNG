/**
 * Sub Admin Team Assignment API
 * POST /api/subadmin/team/assign - Assign a team member to this Sub Admin
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
    const { team_member_id, notes } = body;

    if (!team_member_id) {
      return NextResponse.json({ error: 'team_member_id is required' }, { status: 400 });
    }

    // Verify team member exists and has correct role for department
    const { data: teamMember, error: memberError } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', team_member_id)
      .single();

    if (memberError || !teamMember) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    const memberRoleCode = (teamMember.roles as any)?.role_code;
    
    // Verify role matches department
    const expectedRoles: Record<string, string[]> = {
      'CSE': ['CUSTOMER_SERVICE_EXECUTIVE'],
      'TELECALLER': ['TELECALLER'],
      'AUDITOR': ['AUDITOR'],
    };

    if (!expectedRoles[department]?.includes(memberRoleCode)) {
      return NextResponse.json(
        { error: `Team member must have role ${expectedRoles[department]?.join(' or ')} for ${department} department` },
        { status: 400 }
      );
    }

    // Check if assignment already exists
    const { data: existingAssignment } = await supabase
      .from('subadmin_team_assignments')
      .select('id, is_active')
      .eq('subadmin_id', user.id)
      .eq('team_member_id', team_member_id)
      .eq('department', department)
      .maybeSingle();

    if (existingAssignment) {
      if (existingAssignment.is_active) {
        return NextResponse.json({ error: 'Team member already assigned' }, { status: 409 });
      } else {
        // Reactivate assignment
        const { error: updateError } = await supabase
          .from('subadmin_team_assignments')
          .update({
            is_active: true,
            assigned_at: new Date().toISOString(),
            assigned_by: user.id,
            notes: notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAssignment.id);

        if (updateError) {
          console.error('Error reactivating assignment:', updateError);
          return NextResponse.json({ error: 'Failed to reactivate assignment' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Team member reassigned' });
      }
    }

    // Create new assignment
    const { data: newAssignment, error: insertError } = await supabase
      .from('subadmin_team_assignments')
      .insert({
        subadmin_id: user.id,
        team_member_id: team_member_id,
        department: department,
        assigned_by: user.id,
        notes: notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error assigning team member:', insertError);
      return NextResponse.json({ error: 'Failed to assign team member', details: insertError.message }, { status: 500 });
    }

    // Log action
    await supabase.from('subadmin_actions').insert({
      subadmin_id: user.id,
      department: department,
      action_type: 'ASSIGN_TEAM_MEMBER',
      action_description: `Assigned team member ${team_member_id}`,
      related_entity_type: 'USER',
      related_entity_id: team_member_id,
      metadata: { notes: notes || null },
    });

    return NextResponse.json({
      success: true,
      assignment: newAssignment,
      message: 'Team member assigned successfully',
    });

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/team/assign:', error);
    
    // Handle JSON parse errors
    if (error.message?.includes('JSON')) {
      return NextResponse.json(
        { error: 'Invalid request format. Please check your request body.' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

