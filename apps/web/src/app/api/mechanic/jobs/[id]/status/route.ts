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
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, workshop_id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      console.error('Profile error:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is mechanic
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_MECHANIC') {
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
        if (!currentJob.started_at) {
          updates.started_at = now;
        }
        break;
      case 'HOLD':
        updates.paused_at = now;
        break;
      case 'COMPLETED':
        // Validate before allowing completion
        if (currentJob.before_images_count < currentJob.min_before_images) {
          return NextResponse.json({ 
            error: 'Cannot complete job: Insufficient before images',
            required: currentJob.min_before_images,
            current: currentJob.before_images_count
          }, { status: 400 });
        }
        if (currentJob.after_images_count < currentJob.min_after_images) {
          return NextResponse.json({ 
            error: 'Cannot complete job: Insufficient after images',
            required: currentJob.min_after_images,
            current: currentJob.after_images_count
          }, { status: 400 });
        }
        if (!currentJob.checklist_completed) {
          return NextResponse.json({ 
            error: 'Cannot complete job: Checklist not completed'
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

    // If status is COMPLETED, also update service_leads
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
          old_status: 'IN_PROGRESS',
          new_status: 'WORK_COMPLETED',
          changed_by: userProfile.id,
          changed_at: now,
          reason: 'Mechanic completed the job',
          notes: notes || 'Job completed by mechanic'
        });
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

