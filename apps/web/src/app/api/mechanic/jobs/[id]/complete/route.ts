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

    // Verify user is mechanic
    if (userProfile.role !== 'workshop_mechanic') {
      return NextResponse.json({ error: 'Forbidden: Mechanic only' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { notes, work_summary } = body;

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

    // Verify lead is assigned to this mechanic
    if (lead.assigned_mechanic_id !== userProfile.id) {
      return NextResponse.json({ error: 'Job not assigned to you' }, { status: 403 });
    }

    // Verify lead is in a valid status for completion
    // Allow multiple statuses: IN_PROGRESS, MECHANIC_WORKING, VEHICLE_DROPPED_AT_WORKSHOP
    const allowedStatuses = ['IN_PROGRESS', 'MECHANIC_WORKING', 'VEHICLE_DROPPED_AT_WORKSHOP'];
    if (!allowedStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: 'Job must be in progress to mark complete',
        current_status: lead.status,
        allowed_statuses: allowedStatuses
      }, { status: 400 });
    }

    // Check if required images are uploaded
    const { count: beforeImages } = await supabase
      .from('lead_media')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .eq('category', 'BEFORE');

    const { count: afterImages } = await supabase
      .from('lead_media')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .eq('category', 'AFTER');

    if (!beforeImages || beforeImages < 1) {
      return NextResponse.json({ 
        error: 'Before images are required',
        hint: 'Please upload at least 1 before image'
      }, { status: 400 });
    }

    if (!afterImages || afterImages < 1) {
      return NextResponse.json({ 
        error: 'After images are required',
        hint: 'Please upload at least 1 after image'
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Set status to WORK_COMPLETED when mechanic completes job
    // Supervisor will see this status and can perform QC
    const finalStatus = 'WORK_COMPLETED';

    // Update lead status - set to WORK_COMPLETED
    const updateData: any = {
      status: finalStatus,
      mechanic_completed_at: now,
      notes: work_summary || notes || lead.notes,
      updated_at: now
    };

    // If supervisor is assigned, set QC status to PENDING
    if (lead.assigned_supervisor_id) {
      updateData.qc_status = 'PENDING';
    }

    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error completing job:', updateError);
      return NextResponse.json({ error: 'Failed to complete job', details: updateError.message }, { status: 500 });
    }

    // Log status change in lead_status_history
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: finalStatus,
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Mechanic completed the job',
        notes: work_summary || notes || 'Job completed successfully'
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'JOB_COMPLETED',
        description: 'Mechanic marked job as completed',
        old_status: lead.status,
        new_status: finalStatus,
        metadata: {
          mechanic_id: userProfile.id,
          completed_at: now,
          work_summary: work_summary,
          notes: notes,
          before_images_count: beforeImages,
          after_images_count: afterImages
        }
      });

    // Update mechanic assignment status
    await supabase
      .from('mechanic_assignments')
      .update({
        status: 'COMPLETED',
        completed_at: now
      })
      .eq('lead_id', leadId)
      .eq('mechanic_id', userProfile.id)
      .eq('status', 'ACTIVE');

    // Update mechanic_jobs table
    const { data: mechanicJob } = await supabase
      .from('mechanic_jobs')
      .select('id')
      .eq('lead_id', leadId)
      .single();

    if (mechanicJob) {
      await supabase
        .from('mechanic_jobs')
        .update({
          mechanic_status: 'COMPLETED',
          completed_at: now
        })
        .eq('id', mechanicJob.id);
    }

    // TODO: Send notification to workshop admin
    // TODO: Send notification to customer

    return NextResponse.json({
      success: true,
      message: 'Job completed successfully',
      lead: updatedLead,
      status: finalStatus,
      next_step: lead.assigned_supervisor_id 
        ? 'Job sent to supervisor for Quality Check (QC)'
        : 'Job completed. Awaiting workshop admin approval',
      images: {
        before: beforeImages,
        after: afterImages
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in complete job API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

