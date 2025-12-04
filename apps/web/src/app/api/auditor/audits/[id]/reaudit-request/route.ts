/**
 * Request Re-Audit API
 * POST /api/auditor/audits/[id]/reaudit-request
 * 
 * Request a re-audit for an audit that failed or needs follow-up
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
    const { reason, scheduled_date, notes } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }

    // Get audit details
    const { data: jobCardAudit } = await supabase
      .from('audits')
      .select('id, lead_id, workshop_id:service_leads!lead_id(workshop_id)')
      .eq('id', auditId)
      .eq('auditor_id', user.id)
      .single();

    if (jobCardAudit) {
      // Update audit
      await supabase
        .from('audits')
        .update({
          re_audit_required: true,
          status: 'FOLLOW_UP_REQUIRED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', auditId);

      // Create new audit record for re-audit
      const { data: newAudit, error: createError } = await supabase
        .from('audits')
        .insert({
          lead_id: jobCardAudit.lead_id,
          auditor_id: user.id,
          audit_type: 'FOLLOW_UP',
          status: scheduled_date ? 'SCHEDULED' : 'PENDING',
          audit_date: scheduled_date || null,
          remarks: `Re-audit requested: ${reason}. ${notes || ''}`,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Log activity
      await supabase.from('lead_activities').insert({
        lead_id: jobCardAudit.lead_id,
        user_id: user.id,
        activity_type: 'RE_AUDIT_REQUESTED',
        description: `Re-audit requested: ${reason}`,
      });

      return NextResponse.json({
        success: true,
        message: 'Re-audit requested successfully',
        re_audit: newAudit,
      });
    }

    // Try workshop audit
    const { data: workshopAudit } = await supabase
      .from('workshop_audits')
      .select('id, workshop_id')
      .eq('id', auditId)
      .eq('auditor_id', user.id)
      .single();

    if (workshopAudit) {
      // Update audit
      await supabase
        .from('workshop_audits')
        .update({
          requires_follow_up: true,
          follow_up_date: scheduled_date || null,
          follow_up_notes: `Re-audit requested: ${reason}. ${notes || ''}`,
          audit_status: 'FOLLOW_UP_REQUIRED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', auditId);

      // Create follow-up audit
      const { data: followUpAudit, error: createError } = await supabase
        .from('workshop_audits')
        .insert({
          workshop_id: workshopAudit.workshop_id,
          auditor_id: user.id,
          audit_type: 'FOLLOW_UP',
          audit_status: scheduled_date ? 'SCHEDULED' : 'PENDING',
          scheduled_date: scheduled_date || new Date().toISOString(),
          notes: `Re-audit requested: ${reason}. ${notes || ''}`,
          follow_up_audit_id: auditId,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      return NextResponse.json({
        success: true,
        message: 'Workshop re-audit requested successfully',
        re_audit: followUpAudit,
      });
    }

    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  } catch (error: any) {
    console.error('Error in POST /api/auditor/audits/[id]/reaudit-request:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

