import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
      .select('id, role, workshop_id')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is supervisor
    if (userProfile.role !== 'workshop_supervisor') {
      return NextResponse.json({ error: 'Forbidden: Supervisor only' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { reason, failed_checklist_items, notes } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

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

    // Verify lead is in QC_PENDING or WORK_COMPLETED status
    if (lead.status !== 'QC_PENDING' && lead.status !== 'WORK_COMPLETED') {
      return NextResponse.json({ 
        error: 'Job must be in QC_PENDING or WORK_COMPLETED status',
        current_status: lead.status
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Send job back to IN_PROGRESS for mechanic to rework
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        status: 'IN_PROGRESS',
        qc_status: 'REJECTED',
        qc_performed_by: userProfile.id,
        qc_performed_at: now,
        qc_notes: reason,
        updated_at: now
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error rejecting QC:', updateError);
      return NextResponse.json({ error: 'Failed to reject QC' }, { status: 500 });
    }

    // Create/Update QC check record
    await supabase
      .from('qc_checks')
      .upsert({
        lead_id: leadId,
        supervisor_id: userProfile.id,
        qc_status: 'FAILED',
        failed_reason: reason,
        supervisor_notes: notes || reason,
        checklist_data: failed_checklist_items || {},
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
        new_status: 'IN_PROGRESS',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Quality check rejected - requires rework',
        notes: `Rejection reason: ${reason}. ${notes || ''}`
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'QC_REJECTED',
        description: `Supervisor rejected quality check: ${reason}`,
        old_status: lead.status,
        new_status: 'IN_PROGRESS',
        metadata: {
          supervisor_id: userProfile.id,
          rejected_at: now,
          reason: reason,
          notes: notes,
          failed_items: failed_checklist_items
        }
      });

    // TODO: Send notification to mechanic (job needs rework)
    // TODO: Send notification to workshop admin

    return NextResponse.json({
      success: true,
      message: 'Quality check rejected - Job sent back to mechanic for rework',
      lead: updatedLead,
      rejection_reason: reason,
      next_step: 'Mechanic will rework the job and resubmit for QC'
    }, { status: 200 });

  } catch (error) {
    console.error('Error in reject QC API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

