import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { notifyReadyForQC, createNotification, notifyWorkshopRoles, notifyTelecallerForLead } from '@/lib/notifications';
import { isDummyWorkshopLead, checkMandatoryPickupPhotos } from '@/lib/workshop/pickupPhotos';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClientFromRequest(request);
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile (users_login is mapped by email/phone; not always same as auth user.id)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, role_id, roles!inner(role_code)';

    const { data: userProfileByEmail, error: profileErrorByEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileByPhone, error: profileErrorByPhone } = !userProfileByEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileById, error: profileErrorById } = !userProfileByEmail && !userProfileByPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null, error: null };

    const userProfile = userProfileByEmail || userProfileByPhone || userProfileById;

    if (!userProfile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          user_email: email || null,
          user_phone: phone || null,
          profile_lookup_errors: [profileErrorByEmail?.message, profileErrorByPhone?.message, profileErrorById?.message].filter(Boolean),
        },
        { status: 404 }
      );
    }

    // Verify user is mechanic
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_MECHANIC') {
      return NextResponse.json({ error: 'Forbidden: Mechanic only' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { notes, work_summary } = body;

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    }

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

    const dummyLead = isDummyWorkshopLead(lead);

    // Verify lead is assigned to this mechanic
    if (lead.assigned_mechanic_id !== userProfile.id) {
      return NextResponse.json({ error: 'Job not assigned to you' }, { status: 403 });
    }

    const allowedStatuses = [
      'IN_PROGRESS',
      'MECHANIC_WORKING',
      'REWORK_REQUIRED',
      'VEHICLE_DROPPED_AT_WORKSHOP',
      'WORK_COMPLETED',
      'TEAM_ASSIGNED',
      'ACCEPTED',
      'ASSIGNED',
    ];
    if (!allowedStatuses.includes(lead.status) && !dummyLead) {
      return NextResponse.json({ 
        error: 'Job must be in progress to mark complete',
        current_status: lead.status,
        allowed_statuses: allowedStatuses
      }, { status: 400 });
    }

    // If already WORK_COMPLETED, just return success (idempotent)
    if (lead.status === 'WORK_COMPLETED') {
      try {
        const qc = String(lead.qc_status || '').toUpperCase();
        if (!qc || qc === 'PENDING') {
          await notifyReadyForQC(
            leadId,
            lead.lead_number || leadId,
            lead.assigned_supervisor_id,
            lead.workshop_id,
          );
        }
      } catch (notifError) {
        console.warn('Pending QC notify on already-complete job failed:', notifError);
      }
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
    const { data: jobRows } = await supabase
      .from('mechanic_jobs')
      .select('id')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1);
    const jobRow = jobRows?.[0] || null;

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
        (photos || [])
          .filter((p) => {
            const type = String(p.photo_type || '').toUpperCase();
            return (
              p.photo_category === 'after' &&
              !type.startsWith('EXTRA_WORK') &&
              !type.startsWith('AFTER_VIDEO')
            );
          })
          .map((p) => p.photo_type)
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

      if (missing.some((item) => String(item).startsWith('BEFORE_'))) {
        try {
          const pickupCheck = await checkMandatoryPickupPhotos(supabase, leadId);
          if (pickupCheck.ok) {
            missing = missing.filter((item) => !String(item).startsWith('BEFORE_'));
            beforeImagesCount = Math.max(beforeImagesCount, 6);
          }
        } catch {
          // pickup table missing — keep mechanic before requirement
        }
      }
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

    if (missing.length > 0 && dummyLead) {
      missing = [];
    }

    if (missing.length > 0) {
      // Send notification to mechanic about missing photos
      try {
        const leadNumber = (lead as any)?.lead_number || leadId;
        await createNotification({
          userId: userProfile.id,
          type: 'SYSTEM_ALERT',
          title: 'After-Service Photos Required',
          message: `Cannot complete lead ${leadNumber}. Missing photos: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '...' : ''}`,
          priority: 'HIGH',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`,
          metadata: { kind: 'AFTER_SERVICE_MEDIA_PENDING', missing_count: missing.length, missing_types: missing },
        });
      } catch (e) {
        console.error('Failed to send media pending notification:', e);
      }

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
    const { supabaseAdmin } = getSupabaseAdmin();
    const writer = supabaseAdmin || supabase;

    // IMPORTANT:
    // "Mechanic job complete" means work is finished and job is READY FOR QC.
    const finalStatus = 'WORK_COMPLETED';

    const updateData: any = {
      status: finalStatus,
      mechanic_completed_at: now,
      notes: work_summary || notes || lead.notes,
      updated_at: now,
      qc_status: 'PENDING',
    };

    const { data: updatedLead, error: updateError } = await writer
      .from('service_leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .maybeSingle();

    if (updateError) {
      console.error('Error completing job:', updateError);
      // Check if the error is because status was already changed
      const { data: currentLead } = await writer
        .from('service_leads')
        .select('status')
        .eq('id', leadId)
        .maybeSingle();
      
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
      const { data: currentLead } = await writer
        .from('service_leads')
        .select('status')
        .eq('id', leadId)
        .maybeSingle();
      
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

    try {
      await writer.from('lead_status_history').insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: finalStatus,
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Mechanic completed the job',
        notes: work_summary || notes || 'Job completed successfully',
      });
    } catch (e) {
      console.warn('lead_status_history insert skipped:', e);
    }

    try {
      await writer.from('lead_activities').insert({
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
          after_images_count: afterImagesCount,
        },
      });
    } catch (e) {
      console.warn('lead_activities insert skipped:', e);
    }

    try {
      await writer.from('lead_events').insert({
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
    } catch (e) {
      console.warn('lead_events insert skipped:', e);
    }

    await writer
      .from('mechanic_assignments')
      .update({
        status: 'COMPLETED',
        completed_at: now,
      })
      .eq('lead_id', leadId)
      .eq('mechanic_id', userProfile.id)
      .eq('status', 'ACTIVE');

    const { data: mechanicJobRows } = await writer
      .from('mechanic_jobs')
      .select('id')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1);
    const mechanicJob = mechanicJobRows?.[0] || null;

    if (mechanicJob) {
      await writer
        .from('mechanic_jobs')
        .update({
          mechanic_status: 'COMPLETED',
          completed_at: now,
        })
        .eq('id', mechanicJob.id);
    }

    // Notifications (non-blocking)
    try {
      const leadNumber = updatedLead.lead_number || lead.lead_number || leadId;
      const mechanicName = (userProfile as any)?.full_name || 'Mechanic';

      // 1. Notify supervisor (ready for QC)
      await notifyReadyForQC(leadId, leadNumber, lead.assigned_supervisor_id, lead.workshop_id);

      // 2. Confirm to mechanic that job was submitted
      await createNotification({
        userId: userProfile.id,
        type: 'JOB_COMPLETED',
        title: 'Job submitted for QC',
        message: `Your work on lead ${leadNumber} has been submitted for quality check.`,
        priority: 'MEDIUM',
        leadId,
        leadNumber,
        actionUrl: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`,
        metadata: { kind: 'JOB_COMPLETED_CONFIRMATION' },
      });

      // 3. Notify workshop admin
      if ((lead as any).workshop_id) {
        await notifyWorkshopRoles({
          workshopId: (lead as any).workshop_id,
          roleCodes: ['WORKSHOP_ADMIN'],
          type: 'JOB_COMPLETED',
          title: 'Job completed',
          message: `${mechanicName} completed work on lead ${leadNumber}. Awaiting QC.`,
          priority: 'LOW',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_admin/jobs`,
          metadata: { kind: 'JOB_COMPLETED_ADMIN' },
        });
      }

      // 4. Notify telecaller
      await notifyTelecallerForLead({
        leadId,
        leadNumber,
        type: 'JOB_COMPLETED',
        title: 'Job completed',
        message: `Work completed for lead ${leadNumber}. Awaiting quality check.`,
        priority: 'MEDIUM',
        metadata: { kind: 'JOB_COMPLETED_TELECALLER' },
      });
    } catch (notifError) {
      console.error('Job completion notifications failed (non-blocking):', notifError);
    }

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

