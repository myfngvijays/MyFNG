import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

    // Get user profile with role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, workshop_id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is supervisor
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_SUPERVISOR') {
      return NextResponse.json({ error: 'Forbidden: Supervisor only' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { notes, checklist_data, quality_score } = body;

    const leadId = params.id;

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify lead is from this workshop
    if (lead.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Job not in your workshop' }, { status: 403 });
    }

    // Verify lead is ready for QC (mechanic has completed work)
    // Check if mechanic_completed_at is set OR status indicates work is done
    const isReadyForQC = lead.mechanic_completed_at || 
                        ['IN_PROGRESS', 'WORK_COMPLETED', 'COMPLETED', 'QC_PENDING'].includes(lead.status) ||
                        (!lead.qc_status || lead.qc_status === 'PENDING');
    
    if (!isReadyForQC) {
      return NextResponse.json({ 
        error: 'Job is not ready for QC approval',
        current_status: lead.status,
        mechanic_completed_at: lead.mechanic_completed_at,
        qc_status: lead.qc_status
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update lead status to QC_APPROVED
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        status: 'QC_APPROVED',
        qc_status: 'APPROVED',
        qc_performed_by: userProfile.id,
        qc_performed_at: now,
        qc_notes: notes || 'Quality check approved',
        updated_at: now
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error approving QC:', updateError);
      return NextResponse.json({ error: 'Failed to approve QC' }, { status: 500 });
    }

    // Create/Update QC check record
    await supabase
      .from('qc_checks')
      .upsert({
        lead_id: leadId,
        supervisor_id: userProfile.id,
        qc_status: 'APPROVED',
        images_verified: true,
        parts_verified: true,
        mechanic_notes_approved: true,
        checklist_data: checklist_data || {},
        supervisor_notes: notes || 'Quality check passed',
        created_at: now,
        updated_at: now
      }, {
        onConflict: 'lead_id'
      });

    // Log status change in lead_status_history
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'QC_APPROVED',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Quality check approved by supervisor',
        notes: notes || 'All checks passed'
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'QC_APPROVED',
        description: 'Supervisor approved quality check',
        old_status: lead.status,
        new_status: 'QC_APPROVED',
        metadata: {
          supervisor_id: userProfile.id,
          approved_at: now,
          notes: notes,
          quality_score: quality_score,
          checklist_data: checklist_data
        }
      });

    // Check if audit is required
    let nextStep = 'Job ready for billing/invoice generation';
    if (lead.audit_required) {
      await supabase
        .from('service_leads')
        .update({
          status: 'AUDIT_PENDING',
          audit_status: 'PENDING'
        })
        .eq('id', leadId);

      nextStep = 'Job sent to auditor for final verification';
    } else {
      // Move to invoice generation
      await supabase
        .from('service_leads')
        .update({
          status: 'READY_FOR_BILLING'
        })
        .eq('id', leadId);
    }

    // TODO: Send notification to workshop admin
    // TODO: Send notification to billing team
    // TODO: Send notification to auditor (if audit required)

    return NextResponse.json({
      success: true,
      message: 'Quality check approved successfully',
      lead: updatedLead,
      next_step: nextStep,
      quality_score: quality_score
    }, { status: 200 });

  } catch (error) {
    console.error('Error in approve QC API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

