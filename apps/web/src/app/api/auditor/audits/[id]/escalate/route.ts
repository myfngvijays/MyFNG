/**
 * Escalate Audit API
 * POST /api/auditor/audits/[id]/escalate
 * 
 * Escalate audit findings to Sub Admin or Super Admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    const auditId = params.id;
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Auditor role
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    if (roleCode !== 'AUDITOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      escalation_type,
      priority,
      reason,
      details,
      escalated_to_user_id,
      evidence_urls,
    } = body;

    if (!escalation_type || !reason) {
      return NextResponse.json({ error: 'Escalation type and reason are required' }, { status: 400 });
    }

    // Get audit details
    const { data: jobCardAudit } = await supabase
      .from('audits')
      .select('id, lead_id, workshop_id:service_leads!lead_id(workshop_id)')
      .eq('id', auditId)
      .eq('auditor_id', user.id)
      .single();

    let leadId = null;
    let workshopId = null;

    if (jobCardAudit) {
      leadId = jobCardAudit.lead_id;
      workshopId = (jobCardAudit as any).workshop_id;
    } else {
      const { data: workshopAudit } = await supabase
        .from('workshop_audits')
        .select('id, workshop_id')
        .eq('id', auditId)
        .eq('auditor_id', user.id)
        .single();

      if (!workshopAudit) {
        return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
      }

      workshopId = workshopAudit.workshop_id;
    }

    // Determine escalation target if not provided
    let escalatedTo = escalated_to_user_id;
    if (!escalatedTo) {
      // Default to Auditor Sub Admin
      const { data: subAdmin } = await supabase
        .from('users_login')
        .select('id')
        .eq('department', 'AUDITOR')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (subAdmin) {
        escalatedTo = subAdmin.id;
      } else {
        // Fallback to Super Admin
        const { data: superAdmin } = await supabase
          .from('users_login')
          .select('id, roles!inner(role_code)')
          .eq('roles.role_code', 'SUPER_ADMIN')
          .eq('is_active', true)
          .limit(1)
          .single();

        if (superAdmin) {
          escalatedTo = superAdmin.id;
        }
      }
    }

    if (!escalatedTo) {
      return NextResponse.json({ error: 'No escalation target found' }, { status: 400 });
    }

    // Create escalation record
    const { data: escalation, error: escalationError } = await supabase
      .from('audit_escalations')
      .insert({
        audit_id: auditId,
        lead_id: leadId,
        workshop_id: workshopId,
        escalation_type: escalation_type,
        priority: priority || 'HIGH',
        reason: reason,
        details: details,
        escalated_by: user.id,
        escalated_to: escalatedTo,
        evidence_urls: evidence_urls || [],
      })
      .select()
      .single();

    if (escalationError) {
      throw escalationError;
    }

    // Update audit escalation flag
    if (jobCardAudit) {
      await supabase
        .from('audits')
        .update({
          escalated: true,
          escalation_reason: reason,
          escalated_to: escalatedTo,
          escalated_at: new Date().toISOString(),
        })
        .eq('id', auditId);
    } else {
      await supabase
        .from('workshop_audits')
        .update({
          escalated: true,
          escalation_reason: reason,
        })
        .eq('id', auditId);
    }

    // Create escalation in escalations table (for Sub Admin dashboard)
    await supabase.from('escalations').insert({
      escalation_number: `AUDIT-${auditId.slice(0, 8)}`,
      department: 'AUDITOR',
      escalation_type: 'WORKSHOP',
      priority: priority || 'HIGH',
      status: 'OPEN',
      lead_id: leadId,
      workshop_id: workshopId,
      escalated_by: user.id,
      escalated_to: escalatedTo,
      escalation_reason: reason,
    });

    return NextResponse.json({
      success: true,
      message: 'Audit escalated successfully',
      escalation: escalation,
    });
  } catch (error: any) {
    console.error('Error in POST /api/auditor/audits/[id]/escalate:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

