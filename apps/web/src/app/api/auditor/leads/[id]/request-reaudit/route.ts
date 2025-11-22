/**
 * Auditor Request Re-audit API
 * POST /api/auditor/leads/[id]/request-reaudit
 * 
 * Request re-audit or additional verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ReauditRequest {
  reason: string;
  specific_concerns: string[];
  additional_images_required?: boolean;
  supervisor_review_required?: boolean;
  expected_completion_date?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const body: ReauditRequest = await request.json();

    if (!body.reason || !body.specific_concerns || body.specific_concerns.length === 0) {
      return NextResponse.json({ 
        error: 'Reason and specific concerns required for re-audit'
      }, { status: 400 });
    }

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Update lead to pending re-audit
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        audit_status: 'AUDIT_PENDING',
        audit_notes: `Re-audit requested: ${body.reason}`,
        updated_at: now,
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error requesting re-audit:', updateError);
      return NextResponse.json({ error: 'Failed to request re-audit' }, { status: 500 });
    }

    // Log re-audit request
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'REAUDIT_REQUESTED',
        description: `Re-audit requested by ${userProfile.full_name}: ${body.reason}`,
        metadata: {
          auditor_id: userProfile.id,
          reason: body.reason,
          specific_concerns: body.specific_concerns,
          additional_images_required: body.additional_images_required,
          supervisor_review_required: body.supervisor_review_required,
          requested_at: now,
        },
      });

    // Notify supervisor if required
    if (body.supervisor_review_required && lead.assigned_supervisor_id) {
      await supabase.from('notifications').insert({
        user_id: lead.assigned_supervisor_id,
        type: 'REAUDIT_REQUESTED',
        title: 'Re-audit Requested',
        message: `Auditor requested re-audit for lead ${lead.lead_number}`,
        priority: 'HIGH',
        lead_id: leadId,
        lead_number: lead.lead_number,
        action_url: `/dashboard/workshop_supervisor/leads/${leadId}`,
        metadata: { concerns: body.specific_concerns },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Re-audit requested successfully',
      lead: updatedLead,
      reaudit_details: {
        requested_by: userProfile.full_name,
        reason: body.reason,
        concerns: body.specific_concerns,
        requested_at: now,
      },
    }, { status: 200 });

  } catch (error) {
    console.error('Error in request re-audit API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

