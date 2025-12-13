import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { notifyReadyForQC } from '@/lib/notifications';

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

    // Prevent edits after archival/closure
    if (lead.read_only) {
      return NextResponse.json({
        error: 'Lead is archived/read-only',
        hint: 'This job is closed and cannot be modified'
      }, { status: 400 });
    }

    // Verify lead is assigned to this mechanic
    if (lead.assigned_mechanic_id !== userProfile.id) {
      return NextResponse.json({ error: 'Job not assigned to you' }, { status: 403 });
    }

    // Verify lead is in a valid status for completion (work finished by mechanic)
    // Allow multiple statuses where mechanic can submit completion:
    // - IN_PROGRESS / MECHANIC_WORKING: active repair
    // - VEHICLE_DROPPED_AT_WORKSHOP: vehicle arrived but mechanic may directly complete quick jobs
    // Also allow if already WORK_COMPLETED (idempotent operation)
    const allowedStatuses = ['IN_PROGRESS', 'MECHANIC_WORKING', 'REWORK_REQUIRED', 'VEHICLE_DROPPED_AT_WORKSHOP', 'WORK_COMPLETED'];
    if (!allowedStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: 'Job must be in progress to mark complete',
        current_status: lead.status,
        allowed_statuses: allowedStatuses
      }, { status: 400 });
    }

    // If already WORK_COMPLETED, just return success (idempotent)
    if (lead.status === 'WORK_COMPLETED') {
      return NextResponse.json({
        success: true,
        message: 'Job already marked as work completed',
        lead: lead,
        status: 'WORK_COMPLETED'
      }, { status: 200 });
    }

    // Check if required images are uploaded (EXTREME DETAIL):
    // Prefer mechanic_job_photos (structured BEFORE/DURING/AFTER), and fallback to legacy lead_media counts.
    const REQUIRED_BEFORE_TYPES = [
      'BEFORE_FRONT',
      'BEFORE_REAR',
      'BEFORE_LEFT',
      'BEFORE_RIGHT',
      'BEFORE_DASHBOARD',
      'BEFORE_ENGINE_BAY',
    ];
    const REQUIRED_AFTER_TYPES = [
      'AFTER_FRONT',
      'AFTER_REAR',
      'AFTER_LEFT',
      'AFTER_RIGHT',
      'AFTER_ENGINE_BAY',
      'AFTER_OLD_PARTS', // mandatory old-vs-new parts proof (at least old parts)
      'AFTER_ODOMETER',
    ];
    const MIN_DURING_PHOTOS = 1; // at least one DURING proof is mandatory

    // Get job_id for this lead (mechanic_job_photos is keyed by job_id)
    const { data: jobRow } = await supabase
      .from('mechanic_jobs')
      .select('id')
      .eq('lead_id', leadId)
      .maybeSingle();

    let beforeImagesCount = 0;
    let afterImagesCount = 0;
    let duringImagesCount = 0;
    let missing: string[] = [];

    if (jobRow?.id) {
      const { data: photos } = await supabase
        .from('mechanic_job_photos')
        .select('photo_category, photo_type')
        .eq('job_id', jobRow.id);

      const beforeTypes = new Set(
        (photos || []).filter(p => p.photo_category === 'before').map(p => p.photo_type)
      );
      const afterTypes = new Set(
        (photos || []).filter(p => p.photo_category === 'after').map(p => p.photo_type)
      );
      const duringCount = (photos || []).filter(p => p.photo_category === 'during').length;

      REQUIRED_BEFORE_TYPES.forEach(t => {
        if (!beforeTypes.has(t)) missing.push(t);
      });
      REQUIRED_AFTER_TYPES.forEach(t => {
        if (!afterTypes.has(t)) missing.push(t);
      });
      if (duringCount < MIN_DURING_PHOTOS) {
        missing.push('DURING_* (at least 1 during-service photo)');
      }

      beforeImagesCount = beforeTypes.size;
      afterImagesCount = afterTypes.size;
      duringImagesCount = duringCount;
    } else {
      // Legacy fallback (older flow): only checks basic before/after counts.
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

      beforeImagesCount = beforeImages || 0;
      afterImagesCount = afterImages || 0;

      if (beforeImagesCount < 1) missing.push('BEFORE_* (at least 1 before photo)');
      if (afterImagesCount < 1) missing.push('AFTER_* (at least 1 after photo)');
    }

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: 'Required photos are missing',
          hint: 'Upload all mandatory BEFORE, DURING, AFTER photos and old parts proof before completing the job',
          missing,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // IMPORTANT:
    // "Mechanic job complete" means work is finished and job is READY FOR QC.
    // It must NOT jump to final completion/closure states (those happen after:
    // QC -> Billing -> Invoice -> Payment -> Delivery -> CSE -> Closure).
    const finalStatus = 'WORK_COMPLETED';

    // Update lead status - set to COMPLETED
    const updateData: any = {
      status: finalStatus,
      mechanic_completed_at: now,
      notes: work_summary || notes || lead.notes,
      updated_at: now
    };

    // Always set QC status to PENDING when mechanic completes/resubmits work.
    // Supervisor QC will set qc_status to PASSED/FAILED.
    updateData.qc_status = 'PENDING';

    // Use a WHERE clause to ensure we only update if status hasn't changed
    // This prevents race conditions where status might be changed by another process
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update(updateData)
      .eq('id', leadId)
      .in('status', allowedStatuses.filter(s => s !== 'COMPLETED')) // Only update if status is still in allowed pre-completion states
      .select()
      .single();

    if (updateError) {
      console.error('Error completing job:', updateError);
      // Check if the error is because status was already changed
      const { data: currentLead } = await supabase
        .from('service_leads')
        .select('status')
        .eq('id', leadId)
        .single();
      
      if (currentLead?.status === 'WORK_COMPLETED') {
        // Status was already updated, return success
        return NextResponse.json({
          success: true,
          message: 'Job already marked as work completed',
          lead: currentLead,
          status: 'WORK_COMPLETED'
        }, { status: 200 });
      }
      
      return NextResponse.json({ error: 'Failed to complete job', details: updateError.message }, { status: 500 });
    }

    // Double-check that the update actually happened
    if (!updatedLead) {
      // Status might have been changed by another process, fetch current status
      const { data: currentLead } = await supabase
        .from('service_leads')
        .select('status')
        .eq('id', leadId)
        .single();
      
      if (currentLead?.status === 'WORK_COMPLETED') {
        return NextResponse.json({
          success: true,
          message: 'Job already marked as work completed',
          lead: currentLead,
          status: 'WORK_COMPLETED'
        }, { status: 200 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to complete job - status may have been changed',
        current_status: currentLead?.status 
      }, { status: 500 });
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
          before_images_count: beforeImagesCount,
          during_images_count: duringImagesCount,
          after_images_count: afterImagesCount
        }
      });

    // Lead event for analytics/audit trail
    await supabase
      .from('lead_events')
      .insert({
        lead_id: leadId,
        event_type: 'WORK_COMPLETED',
        event_description: 'Mechanic submitted job completion for QC',
        event_data: {
          mechanic_id: userProfile.id,
          completed_at: now,
          before_images_count: beforeImagesCount,
          during_images_count: duringImagesCount,
          after_images_count: afterImagesCount,
        },
        created_by: userProfile.id,
        created_at: now,
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
    await notifyReadyForQC(leadId, updatedLead.lead_number || lead.lead_number || leadId, lead.assigned_supervisor_id, lead.workshop_id);

    return NextResponse.json({
      success: true,
      message: 'Job completed successfully',
      lead: updatedLead,
      status: finalStatus,
      next_step: lead.assigned_supervisor_id 
        ? 'Job sent to supervisor for Quality Check (QC)'
        : 'Job completed. Awaiting workshop admin approval',
      images: {
        before: beforeImagesCount,
        during: duringImagesCount,
        after: afterImagesCount
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

