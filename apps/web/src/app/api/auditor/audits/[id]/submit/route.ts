/**
 * Submit Audit API
 * POST /api/auditor/audits/[id]/submit
 * 
 * Submit completed audit with findings and recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      findings,
      recommendations,
      issues_severity,
      re_audit_required,
      workshop_manager_meeting_required,
      auditor_remarks,
    } = body;

    // Try job card audit first
    const { data: jobCardAudit } = await supabase
      .from('audits')
      .select('id, lead_id, status')
      .eq('id', auditId)
      .eq('auditor_id', user.id)
      .single();

    if (jobCardAudit) {
      // Insert findings if provided
      if (findings && Array.isArray(findings)) {
        for (const finding of findings) {
          await supabase.from('audit_findings').insert({
            audit_id: auditId,
            finding_type: finding.finding_type,
            severity: finding.severity,
            title: finding.title,
            description: finding.description,
            evidence_photos: finding.evidence_photos || [],
            evidence_notes: finding.evidence_notes,
            requires_re_audit: finding.requires_re_audit || false,
          });
        }
      }

      // Update audit
      const updateData: any = {
        status: 'COMPLETED',
        findings: findings ? JSON.stringify(findings) : null,
        recommendations: recommendations,
        issues_severity: issues_severity,
        re_audit_required: re_audit_required || false,
        workshop_manager_meeting_required: workshop_manager_meeting_required || false,
        auditor_remarks: auditor_remarks,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('audits')
        .update(updateData)
        .eq('id', auditId);

      if (updateError) {
        throw updateError;
      }

      // Log activity
      await supabase.from('lead_activities').insert({
        lead_id: jobCardAudit.lead_id,
        user_id: user.id,
        activity_type: 'AUDIT_COMPLETED',
        description: `Audit completed by auditor. Severity: ${issues_severity || 'N/A'}`,
      });

      // Notify Sub Admin
      const { data: subAdmins } = await supabase
        .from('users_login')
        .select('id')
        .eq('department', 'AUDITOR')
        .eq('is_active', true);

      return NextResponse.json({
        success: true,
        message: 'Audit submitted successfully',
        audit: {
          id: auditId,
          status: 'COMPLETED',
        },
      });
    }

    // Try workshop audit
    const { data: workshopAudit } = await supabase
      .from('workshop_audits')
      .select('id, workshop_id, audit_status')
      .eq('id', auditId)
      .eq('auditor_id', user.id)
      .single();

    if (workshopAudit) {
      const updateData: any = {
        audit_status: 'COMPLETED',
        actual_end_time: new Date().toISOString(),
        strengths: body.strengths,
        weaknesses: body.weaknesses,
        recommendations: recommendations,
        critical_issues: body.critical_issues || [],
        action_items: body.action_items || [],
        requires_follow_up: re_audit_required || false,
        follow_up_date: body.follow_up_date || null,
        auditor_remarks: auditor_remarks,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('workshop_audits')
        .update(updateData)
        .eq('id', auditId);

      if (updateError) {
        throw updateError;
      }

      // Update workshop rating if score is available
      if (body.score_percentage) {
        await supabase
          .from('workshops')
          .update({
            audit_score: body.score_percentage,
            last_audit_date: new Date().toISOString(),
          })
          .eq('id', workshopAudit.workshop_id);
      }

      return NextResponse.json({
        success: true,
        message: 'Workshop audit submitted successfully',
        audit: {
          id: auditId,
          status: 'COMPLETED',
        },
      });
    }

    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  } catch (error: any) {
    console.error('Error in POST /api/auditor/audits/[id]/submit:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

