import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST - Update job status
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
    // NOTE: `users_login.id` is not always the same as Supabase Auth `user.id` in this codebase.
    // Prefer email lookup (consistent with other routes), fallback to id.
    const { data: userProfileByEmail } = await supabase
      .from('users_login')
      .select('id, email, role, workshop_id, roles!inner(role_code)')
      .eq('email', user.email)
      .maybeSingle();

    const { data: userProfileById, error: profileErrorById } = !userProfileByEmail
      ? await supabase
          .from('users_login')
          .select('id, email, role, workshop_id, roles!inner(role_code)')
          .eq('id', user.id)
          .maybeSingle()
      : { data: null, error: null };

    const userProfile = userProfileByEmail || userProfileById;

    if (!userProfile) {
      console.error('Profile error:', profileErrorById);
      return NextResponse.json(
        { error: 'User profile not found', user_email: user.email },
        { status: 404 }
      );
    }

    // Verify user is mechanic
    const roleCode = (userProfile.roles as any)?.role_code;
    const legacyRole = (userProfile as any)?.role;
    if (roleCode !== 'WORKSHOP_MECHANIC' && legacyRole !== 'workshop_mechanic') {
      return NextResponse.json({ error: 'Forbidden: Mechanic only' }, { status: 403 });
    }

    const leadId = params.id;

    // Get request body
    const body = await request.json();
    const { status, notes } = body;

    // Validate status
    const validStatuses = ['ASSIGNED', 'IN_PROGRESS', 'HOLD', 'WAITING_APPROVAL', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status',
        valid_statuses: validStatuses
      }, { status: 400 });
    }

    // Get current job
    const { data: currentJob, error: jobError } = await supabase
      .from('mechanic_jobs')
      .select('*, mechanic_status')
      .eq('lead_id', leadId)
      .eq('mechanic_id', userProfile.id)
      .single();

    console.log('Current job query:', { leadId, mechanicId: userProfile.id, found: !!currentJob });

    if (jobError || !currentJob) {
      console.error('Job error:', jobError);
      return NextResponse.json({ 
        error: 'Job not found or not assigned to you',
        details: { leadId, mechanicId: userProfile.id, error: jobError?.message }
      }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updates: any = {
      mechanic_status: status,
      updated_at: now
    };

    // Set timestamps based on status
    switch (status) {
      case 'IN_PROGRESS':
        // Validate before inspection is complete
        if (!currentJob.before_inspection_complete) {
          // Check validation using RPC function
          const { data: validationResult, error: validationError } = await supabase.rpc(
            'validate_before_inspection',
            { job_id_param: currentJob.id }
          );

          if (validationError || !validationResult?.is_valid) {
            const missingPhotos = validationResult?.missing_photos || [];
            const photoCount = validationResult?.photo_count || 0;
            const minRequired = validationResult?.min_required || 6;
            
            let errorMessage = 'Cannot start repair: Before inspection incomplete. ';
            
            if (photoCount < minRequired) {
              errorMessage += `Required ${minRequired} photos, but only ${photoCount} uploaded. `;
            }
            
            if (missingPhotos && missingPhotos.length > 0) {
              const photoNames = missingPhotos.map((type: string) => 
                type.replace('BEFORE_', '').replace('_', ' ')
              ).join(', ');
              errorMessage += `Missing required photos: ${photoNames}. `;
            }
            
            errorMessage += 'Please upload all required photos with correct types (Front, Rear, Left, Right, Dashboard, Engine Bay).';
            
            return NextResponse.json({ 
              error: errorMessage,
              details: {
                message: 'Please complete before inspection with all required photos',
                photo_count: photoCount,
                min_required: minRequired,
                missing_photos: missingPhotos
              }
            }, { status: 400 });
          }
          
          // Mark before inspection as complete if validation passes
          updates.before_inspection_complete = true;
        }
        if (!currentJob.started_at) {
          updates.started_at = now;
        }
        break;
      case 'HOLD':
        updates.paused_at = now;
        break;
      case 'COMPLETED':
        // Validate before allowing completion using RPC function
        const { data: validationResult, error: validationError } = await supabase.rpc(
          'validate_after_service_completion',
          { job_id_param: currentJob.id }
        );

        if (validationError || !validationResult?.is_valid) {
          return NextResponse.json({ 
            error: 'Cannot complete job: Requirements not met',
            details: {
              message: 'Please complete all requirements before marking job as complete',
              photo_count: validationResult?.photo_count || 0,
              min_required: validationResult?.min_required || 6,
              missing_photos: validationResult?.missing_photos || [],
              checklist_completed: validationResult?.checklist_completed || false,
              parts_recorded: validationResult?.parts_recorded || false,
              notes_entered: validationResult?.notes_entered || false
            }
          }, { status: 400 });
        }
        updates.completed_at = now;
        break;
    }

    // Update mechanic_jobs
    const { data: updatedJob, error: updateError } = await supabase
      .from('mechanic_jobs')
      .update(updates)
      .eq('lead_id', leadId)
      .eq('mechanic_id', userProfile.id)
      .select();

    console.log('Update result:', { updatedJob, updateError, affectedRows: updatedJob?.length });

    if (updateError) {
      console.error('Error updating job status:', updateError);
      return NextResponse.json({ error: 'Failed to update job status' }, { status: 500 });
    }

    if (!updatedJob || updatedJob.length === 0) {
      return NextResponse.json({ 
        error: 'No job was updated. Job not found or not assigned to you.',
        details: { leadId, mechanicId: userProfile.id }
      }, { status: 404 });
    }

    const jobResult = updatedJob[0];

    // Get current lead status for history
    const { data: currentLead } = await supabase
      .from('service_leads')
      .select('status')
      .eq('id', leadId)
      .single();

    const oldLeadStatus = currentLead?.status || 'UNKNOWN';

    // Update service_leads based on mechanic job status
    if (status === 'COMPLETED') {
      await supabase
        .from('service_leads')
        .update({
          status: 'WORK_COMPLETED',
          mechanic_completed_at: now,
          updated_at: now
        })
        .eq('id', leadId);

      // Create status history
      await supabase
        .from('lead_status_history')
        .insert({
          lead_id: leadId,
          old_status: oldLeadStatus,
          new_status: 'WORK_COMPLETED',
          changed_by: userProfile.id,
          changed_at: now,
          reason: 'Mechanic completed the job',
          notes: notes || 'Job completed by mechanic'
        });
    } else if (status === 'HOLD') {
      // Update service_leads to ON_HOLD when mechanic puts job on hold
      await supabase
        .from('service_leads')
        .update({
          status: 'ON_HOLD',
          updated_at: now
        })
        .eq('id', leadId);

      // Create status history
      await supabase
        .from('lead_status_history')
        .insert({
          lead_id: leadId,
          old_status: oldLeadStatus,
          new_status: 'ON_HOLD',
          changed_by: userProfile.id,
          changed_at: now,
          reason: 'Mechanic put job on hold',
          notes: notes || 'Job put on hold by mechanic'
        });
    } else if (status === 'IN_PROGRESS') {
      // Update service_leads to IN_PROGRESS when mechanic starts/resumes work
      if (oldLeadStatus !== 'IN_PROGRESS') {
        await supabase
          .from('service_leads')
          .update({
            status: 'IN_PROGRESS',
            mechanic_started_at: currentJob.started_at || now,
            updated_at: now
          })
          .eq('id', leadId);

        // Create status history
        await supabase
          .from('lead_status_history')
          .insert({
            lead_id: leadId,
            old_status: oldLeadStatus,
            new_status: 'IN_PROGRESS',
            changed_by: userProfile.id,
            changed_at: now,
            reason: oldLeadStatus === 'ON_HOLD' ? 'Mechanic resumed work from hold' : 'Mechanic started work',
            notes: notes || (oldLeadStatus === 'ON_HOLD' ? 'Work resumed' : 'Work started')
          });
      }
    }

    // Create activity log
    await supabase
      .from('mechanic_actions_log')
      .insert({
        lead_id: leadId,
        mechanic_id: userProfile.id,
        action_type: 'STATUS_CHANGED',
        action_description: `Status changed from ${currentJob.mechanic_status} to ${status}`,
        metadata: {
          old_status: currentJob.mechanic_status,
          new_status: status,
          notes
        }
      });

    // Calculate work duration if needed
    if (status === 'COMPLETED' && currentJob.started_at) {
      const startTime = new Date(currentJob.started_at).getTime();
      const endTime = new Date(now).getTime();
      const durationMinutes = Math.floor((endTime - startTime) / (1000 * 60));
      
      await supabase
        .from('mechanic_jobs')
        .update({
          actual_work_duration: durationMinutes
        })
        .eq('lead_id', leadId);
    }

    return NextResponse.json({
      success: true,
      message: 'Job status updated successfully',
      job: jobResult,
      old_status: currentJob.mechanic_status,
      new_status: status
    }, { status: 200 });

  } catch (error) {
    console.error('Error in update status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get current job status
export async function GET(
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

    const leadId = params.id;

    // Get job status
    const { data: job, error: jobError } = await supabase
      .from('mechanic_jobs')
      .select('mechanic_status, started_at, paused_at, completed_at, updated_at')
      .eq('lead_id', leadId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      status: job.mechanic_status,
      timestamps: {
        started_at: job.started_at,
        paused_at: job.paused_at,
        completed_at: job.completed_at,
        updated_at: job.updated_at
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

