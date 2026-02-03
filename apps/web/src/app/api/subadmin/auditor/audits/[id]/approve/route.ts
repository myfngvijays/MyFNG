/**
 * Auditor Sub Admin Audit Approval API
 * POST /api/subadmin/auditor/audits/[id]/approve
 * Approve or reject audit
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyWorkshopRoles } from '@/lib/notifications';

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

    if (roleCode !== 'SUB_ADMIN' || department !== 'AUDITOR') {
      return NextResponse.json({ error: 'Forbidden: Auditor Sub Admin role required' }, { status: 403 });
    }

    const auditId = params.id;
    const body = await request.json();
    const { action, approval_notes, rejection_reason, requires_follow_up } = body;

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { error: 'action is required and must be APPROVE or REJECT' },
        { status: 400 }
      );
    }

    // Get current audit
    const { data: currentAudit, error: auditError } = await supabase
      .from('workshop_audits')
      .select('*')
      .eq('id', auditId)
      .single();

    if (auditError || !currentAudit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    }

    if (currentAudit.audit_status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Audit must be completed before approval/rejection' },
        { status: 400 }
      );
    }

    if (action === 'APPROVE') {
      // Approve audit
      const { data: updatedAudit, error: updateError } = await supabase
        .from('workshop_audits')
        .update({
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          approval_notes: approval_notes || `Approved by Auditor Sub Admin: ${userProfile.full_name}`,
          requires_follow_up: requires_follow_up || false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', auditId)
        .select()
        .single();

      if (updateError || !updatedAudit) {
        console.error('Error approving audit:', updateError);
        return NextResponse.json(
          { error: 'Failed to approve audit', details: updateError?.message },
          { status: 500 }
        );
      }

      // Log action
      await supabase.from('subadmin_actions').insert({
        subadmin_id: user.id,
        department: 'AUDITOR',
        action_type: 'APPROVE_AUDIT',
        action_description: `Approved audit ${auditId} for workshop ${currentAudit.workshop_id}`,
        related_entity_type: 'AUDIT',
        related_entity_id: auditId,
        old_status: currentAudit.audit_status,
        new_status: 'APPROVED',
        metadata: {
          approval_notes: approval_notes || null,
          requires_follow_up: requires_follow_up || false,
          audit_grade: currentAudit.audit_grade,
          score_percentage: currentAudit.score_percentage,
        },
      });

      return NextResponse.json({
        success: true,
        audit: updatedAudit,
        message: 'Audit approved successfully',
      });

    } else {
      // Reject audit
      if (!rejection_reason) {
        return NextResponse.json(
          { error: 'rejection_reason is required for REJECT action' },
          { status: 400 }
        );
      }

      const { data: updatedAudit, error: updateError } = await supabase
        .from('workshop_audits')
        .update({
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejection_reason,
          requires_follow_up: true, // Rejected audits always require follow-up
          updated_at: new Date().toISOString(),
        })
        .eq('id', auditId)
        .select()
        .single();

      if (updateError || !updatedAudit) {
        console.error('Error rejecting audit:', updateError);
        return NextResponse.json(
          { error: 'Failed to reject audit', details: updateError?.message },
          { status: 500 }
        );
      }

      // Notify workshop admin/supervisor (audit failed / rejected)
      try {
        await notifyWorkshopRoles({
          workshopId: currentAudit.workshop_id,
          roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
          type: 'SYSTEM_ALERT',
          title: 'Audit Rejected (Action Required)',
          message: `Workshop audit was rejected: ${rejection_reason}. Please address issues and prepare for follow-up.`,
          priority: 'HIGH',
          actionUrl: '/dashboard/workshop_admin/settings',
          metadata: {
            kind: 'AUDIT_REJECTED',
            audit_id: auditId,
            rejection_reason,
            audit_type: currentAudit.audit_type,
            score_percentage: currentAudit.score_percentage,
            audit_grade: currentAudit.audit_grade,
          },
        });
      } catch (e) {
        console.warn('Audit rejected notification failed (non-blocking):', e);
      }

      // Log action
      await supabase.from('subadmin_actions').insert({
        subadmin_id: user.id,
        department: 'AUDITOR',
        action_type: 'REJECT_AUDIT',
        action_description: `Rejected audit ${auditId} for workshop ${currentAudit.workshop_id}`,
        related_entity_type: 'AUDIT',
        related_entity_id: auditId,
        old_status: currentAudit.audit_status,
        new_status: 'REJECTED',
        metadata: {
          rejection_reason: rejection_reason,
          audit_grade: currentAudit.audit_grade,
          score_percentage: currentAudit.score_percentage,
        },
      });

      return NextResponse.json({
        success: true,
        audit: updatedAudit,
        message: 'Audit rejected',
      });
    }

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/auditor/audits/[id]/approve:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

