/**
 * Auditor Sub Admin Audit Assignment API
 * POST /api/subadmin/auditor/audits/[id]/assign
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

    if (roleCode !== 'SUB_ADMIN' || department !== 'AUDITOR') {
      return NextResponse.json({ error: 'Forbidden: Auditor Sub Admin role required' }, { status: 403 });
    }

    const auditId = params.id;
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
      .eq('department', 'AUDITOR')
      .eq('is_active', true)
      .single();

    if (!teamAssignment) {
      return NextResponse.json(
        { error: 'Auditor is not assigned to your team' },
        { status: 403 }
      );
    }

    // Get current audit
    const { data: currentAudit } = await supabase
      .from('workshop_audits')
      .select('id, audit_status, auditor_id')
      .eq('id', auditId)
      .single();

    if (!currentAudit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    }

    // Assign audit
    const { data: updatedAudit, error: updateError } = await supabase
      .from('workshop_audits')
      .update({
        auditor_id: assign_to_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auditId)
      .select()
      .single();

    if (updateError || !updatedAudit) {
      console.error('Error assigning audit:', updateError);
      return NextResponse.json(
        { error: 'Failed to assign audit', details: updateError?.message },
        { status: 500 }
      );
    }

    // Log action
    await supabase.from('subadmin_actions').insert({
      subadmin_id: user.id,
      department: 'AUDITOR',
      action_type: 'ASSIGN_AUDIT',
      action_description: `Assigned audit ${auditId} to Auditor ${assign_to_id}`,
      related_entity_type: 'AUDIT',
      related_entity_id: auditId,
      old_status: currentAudit.audit_status,
      new_status: updatedAudit.audit_status,
      metadata: {
        assigned_to: assign_to_id,
        notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      audit: updatedAudit,
      message: 'Audit assigned successfully',
    });

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/auditor/audits/[id]/assign:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

