/**
 * Auditor Approve Lead API
 * POST /api/auditor/leads/[id]/approve
 * 
 * Approve lead after audit verification
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ApproveAuditRequest {
  audit_score?: number; // 0-100
  audit_notes?: string;
  checklist?: {
    before_images_valid: boolean;
    after_images_valid: boolean;
    service_completed_properly: boolean;
    extra_charges_justified: boolean;
    no_fraud_detected: boolean;
    cleanliness_maintained: boolean;
    customer_satisfaction: boolean;
  };
  recommendations?: string;
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
    const body: ApproveAuditRequest = await request.json();

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Prevent edits after archival/closure
    if (lead.read_only) {
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
    }

    // Validate lead requires audit
    if (!lead.audit_required) {
      return NextResponse.json({ 
        error: 'Lead does not require audit',
        hint: 'This lead was not marked for audit review'
      }, { status: 400 });
    }

    // Validate audit status
    const validStatuses = ['PENDING', 'AUDIT_PENDING', 'AUDIT_FLAGGED'];
    if (lead.audit_status && !validStatuses.includes(lead.audit_status)) {
      return NextResponse.json({ 
        error: 'Invalid audit status',
        current_status: lead.audit_status,
        hint: 'Audit already completed'
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update lead with audit approval
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        audit_status: 'AUDIT_APPROVED',
        audit_performed_by: userProfile.id,
        audit_performed_at: now,
        audit_notes: body.audit_notes,
        audit_score: body.audit_score,
        status: 'AUDIT_APPROVED',
        updated_at: now,
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error approving audit:', updateError);
      return NextResponse.json({ error: 'Failed to approve audit' }, { status: 500 });
    }

    // Log audit approval activity
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'AUDIT_APPROVED',
        description: `Audit approved by ${userProfile.full_name}. Score: ${body.audit_score || 'N/A'}/100`,
        metadata: {
          auditor_id: userProfile.id,
          auditor_name: userProfile.full_name,
          audit_score: body.audit_score,
          checklist: body.checklist,
          recommendations: body.recommendations,
          approved_at: now,
        },
      });

    // Create status history entry (audit approved)
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'AUDIT_APPROVED',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Audit approved',
        notes: body.audit_notes || 'Audit completed successfully. All checks passed.',
      });

    // Move to READY_FOR_BILLING after audit approval (billing starts now)
    await supabase
      .from('service_leads')
      .update({
        status: 'READY_FOR_BILLING',
        updated_at: now,
      })
      .eq('id', leadId);

    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: 'AUDIT_APPROVED',
        new_status: 'READY_FOR_BILLING',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Audit approved - ready for billing',
        notes: 'Lead moved to billing after audit approval',
      });

    await supabase.from('lead_events').insert([
      {
        lead_id: leadId,
        event_type: 'AUDIT_APPROVED',
        event_description: `Audit approved by ${userProfile.full_name}`,
        event_data: { audit_score: body.audit_score, recommendations: body.recommendations },
        created_by: userProfile.id,
        created_at: now,
      },
      {
        lead_id: leadId,
        event_type: 'READY_FOR_BILLING',
        event_description: 'Ready for billing after audit approval',
        created_by: userProfile.id,
        created_at: now,
      },
    ]);

    // Update workshop audit score if applicable
    if (lead.workshop_id && body.audit_score) {
      // Get current workshop audit score
      const { data: workshop } = await supabase
        .from('workshops')
        .select('audit_score')
        .eq('id', lead.workshop_id)
        .single();

      if (workshop) {
        // Calculate new average (simple moving average)
        const currentScore = workshop.audit_score || 0;
        const newScore = ((currentScore * 0.9) + (body.audit_score / 100 * 5 * 0.1)).toFixed(2);
        
        await supabase
          .from('workshops')
          .update({ audit_score: parseFloat(newScore) })
          .eq('id', lead.workshop_id);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Audit approved successfully',
      lead: updatedLead,
      audit_summary: {
        auditor: userProfile.full_name,
        audit_score: body.audit_score,
        approved_at: now,
        checklist_passed: body.checklist,
      },
      next_step: 'Billing team can now generate invoice',
    }, { status: 200 });

  } catch (error) {
    console.error('Error in auditor approve API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

