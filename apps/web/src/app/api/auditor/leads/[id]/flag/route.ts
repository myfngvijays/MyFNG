/**
 * Auditor Flag Lead API
 * POST /api/auditor/leads/[id]/flag
 * 
 * Flag lead for issues or fraud detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createNotification, notifyWorkshopRoles } from '@/lib/notifications';

interface FlagLeadRequest {
  flag_reason: string; // FRAUD_SUSPECTED, IMAGE_MANIPULATION, OVERCHARGING, POOR_SERVICE, OTHER
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence?: string[]; // Array of evidence descriptions
  action_required?: string;
  escalate_to_super_admin?: boolean;
}

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, full_name, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify Auditor role
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'AUDITOR' && roleCode !== 'QC_AUDITOR') {
      return NextResponse.json({ error: 'Forbidden: Auditor role required' }, { status: 403 });
    }

    const leadId = params.id;
    const body: FlagLeadRequest = await request.json();

    // Validate required fields
    if (!body.flag_reason || !body.description || !body.severity) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        required: ['flag_reason', 'description', 'severity']
      }, { status: 400 });
    }

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*, workshop:workshops!workshop_id(name)')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Prevent edits after archival/closure
    if ((lead as any).read_only) {
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update lead with audit flag
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        status: 'AUDIT_FLAGGED',
        audit_status: 'AUDIT_FLAGGED',
        audit_performed_by: userProfile.id,
        audit_performed_at: now,
        audit_notes: `FLAGGED: ${body.flag_reason} - ${body.description}`,
        is_fraud: body.flag_reason === 'FRAUD_SUSPECTED',
        fraud_reason: body.flag_reason === 'FRAUD_SUSPECTED' ? body.description : lead.fraud_reason,
        marked_fraud_by: body.flag_reason === 'FRAUD_SUSPECTED' ? userProfile.id : lead.marked_fraud_by,
        marked_fraud_at: body.flag_reason === 'FRAUD_SUSPECTED' ? now : lead.marked_fraud_at,
        is_escalated: body.escalate_to_super_admin || body.severity === 'CRITICAL',
        escalated_at: body.escalate_to_super_admin || body.severity === 'CRITICAL' ? now : lead.escalated_at,
        escalated_by_id: body.escalate_to_super_admin || body.severity === 'CRITICAL' ? userProfile.id : lead.escalated_by_id,
        escalation_reason: body.escalate_to_super_admin ? body.description : lead.escalation_reason,
        updated_at: now,
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error flagging lead:', updateError);
      return NextResponse.json({ error: 'Failed to flag lead' }, { status: 500 });
    }

    // Log flag activity
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'AUDIT_FLAGGED',
        description: `🚩 Lead flagged by auditor: ${body.flag_reason} (${body.severity})`,
        metadata: {
          auditor_id: userProfile.id,
          auditor_name: userProfile.full_name,
          flag_reason: body.flag_reason,
          severity: body.severity,
          description: body.description,
          evidence: body.evidence,
          action_required: body.action_required,
          escalated: body.escalate_to_super_admin,
          flagged_at: now,
        },
      });

    // Create status history
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'AUDIT_FLAGGED',
        changed_by: userProfile.id,
        changed_at: now,
        reason: `Audit flagged: ${body.flag_reason}`,
        notes: body.description,
      });

    await supabase.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'AUDIT_FLAGGED',
      event_description: `Lead flagged by auditor: ${body.flag_reason} (${body.severity})`,
      event_data: {
        flag_reason: body.flag_reason,
        severity: body.severity,
        description: body.description,
        evidence: body.evidence,
        action_required: body.action_required,
      },
      created_by: userProfile.id,
      created_at: now,
    });

    // If escalated, notify super admin
    if (body.escalate_to_super_admin || body.severity === 'CRITICAL') {
      // Get super admin users
      const { data: superAdmins } = await supabase
        .from('users_login')
        .select('id, roles!inner(role_code)')
        .eq('roles.role_code', 'SUPER_ADMIN')
        .eq('is_active', true);

      // Create notifications for super admins
      if (superAdmins && superAdmins.length > 0) {
        const notifications = superAdmins.map(admin => ({
          user_id: admin.id,
          type: 'AUDIT_ESCALATION',
          title: `🚨 Critical Audit Flag - ${body.flag_reason}`,
          message: `Lead ${lead.lead_number} flagged by auditor. Severity: ${body.severity}`,
          priority: 'URGENT',
          lead_id: leadId,
          lead_number: lead.lead_number,
          action_url: `/dashboard/super_admin/fraud/${leadId}`,
          metadata: { flag_reason: body.flag_reason, severity: body.severity },
        }));

        await supabase.from('notifications').insert(notifications);
      }
    }

    // Notify workshop admin/supervisor (audit failed/flagged)
    try {
      if ((lead as any)?.workshop_id) {
        await notifyWorkshopRoles({
          workshopId: (lead as any).workshop_id,
          roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
          type: 'SYSTEM_ALERT',
          title: `Audit Flagged (${body.severity})`,
          message: `Lead ${lead.lead_number} flagged by auditor: ${body.flag_reason}. ${body.action_required ? `Action: ${body.action_required}` : ''}`.trim(),
          priority: body.severity === 'CRITICAL' ? 'URGENT' : 'HIGH',
          leadId,
          leadNumber: lead.lead_number,
          actionUrl: `/dashboard/workshop_admin/leads/${leadId}`,
          metadata: {
            kind: 'AUDIT_FLAGGED',
            flag_reason: body.flag_reason,
            severity: body.severity,
            description: body.description,
            action_required: body.action_required,
            auditor_id: userProfile.id,
            auditor_name: userProfile.full_name,
          },
        });
      }
    } catch (e) {
      console.warn('Workshop audit-flag notification failed (non-blocking):', e);
    }

    // Notify assigned mechanic (mechanic-focused observation)
    try {
      const mechanicId = (lead as any)?.assigned_mechanic_id as string | null | undefined;
      if (mechanicId) {
        await createNotification({
          userId: mechanicId,
          type: 'AUDIT_FLAGGED',
          title: 'Audit Observation Added',
          message: `Lead ${lead.lead_number || leadId}: ${body.flag_reason}. Review remarks and follow supervisor guidance.`,
          priority: body.severity === 'CRITICAL' ? 'URGENT' : 'HIGH',
          leadId,
          leadNumber: lead.lead_number || leadId,
          actionUrl: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`,
          metadata: {
            kind: 'MECHANIC_AUDIT_OBSERVATION',
            flag_reason: body.flag_reason,
            severity: body.severity,
            description: body.description,
            auditor_id: userProfile.id,
            auditor_name: userProfile.full_name,
          },
        });
      }
    } catch (e) {
      console.warn('Mechanic audit observation notification failed (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      message: 'Lead flagged successfully',
      lead: updatedLead,
      flag_summary: {
        flagged_by: userProfile.full_name,
        flag_reason: body.flag_reason,
        severity: body.severity,
        escalated: body.escalate_to_super_admin || body.severity === 'CRITICAL',
        flagged_at: now,
      },
    }, { status: 200 });

  } catch (error) {
    console.error('Error in auditor flag API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

