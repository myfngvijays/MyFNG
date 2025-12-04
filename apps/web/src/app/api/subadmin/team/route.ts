/**
 * Sub Admin Team Management API
 * GET /api/subadmin/team - Get team members
 * POST /api/subadmin/team/assign - Assign team member
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/subadmin/team
 * Get all team members assigned to this Sub Admin
 */
export async function GET(request: Request) {
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

    // Get team assignments
    const { data: teamAssignments, error: teamError } = await supabase
      .from('subadmin_team_assignments')
      .select(`
        id,
        team_member_id,
        assigned_at,
        is_active,
        notes,
        team_member:users_login!team_member_id(
          id,
          full_name,
          email,
          phone,
          is_active,
          last_login,
          roles!inner(role_code, role_name)
        )
      `)
      .eq('subadmin_id', user.id)
      .eq('department', department)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false });

    if (teamError) {
      console.error('Error fetching team:', teamError);
      return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 });
    }

    // Format response
    const teamMembers = teamAssignments?.map(ta => {
      const member = Array.isArray(ta.team_member) ? ta.team_member[0] : ta.team_member;
      return {
        assignment_id: ta.id,
        member_id: ta.team_member_id,
        assigned_at: ta.assigned_at,
        notes: ta.notes,
        member: {
          id: member?.id,
          full_name: member?.full_name,
          email: member?.email,
          phone: member?.phone,
          is_active: member?.is_active,
          last_login: member?.last_login,
          role: member?.roles,
        },
      };
    }) || [];

    return NextResponse.json({
      team_members: teamMembers,
      total_count: teamMembers.length,
      department: department,
    });

  } catch (error: any) {
    console.error('Error in GET /api/subadmin/team:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/subadmin/team/assign
 * Assign a team member to this Sub Admin
 */
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
      .single();

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
      return NextResponse.json({ error: 'Failed to assign team member' }, { status: 500 });
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
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

