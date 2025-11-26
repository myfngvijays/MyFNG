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

    // Verify user is workshop admin
    if (userProfile.role !== 'workshop_admin') {
      return NextResponse.json({ error: 'Forbidden: Workshop Admin only' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { 
      mechanic_id, 
      supervisor_id, 
      pickup_boy_id, 
      notes 
    } = body;

    if (!mechanic_id) {
      return NextResponse.json({ error: 'Mechanic ID is required' }, { status: 400 });
    }

    const leadId = params.id;

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Verify lead is assigned to this workshop
    if (lead.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Lead not assigned to your workshop' }, { status: 403 });
    }

    // Verify lead is in ACCEPTED status
    if (lead.status !== 'ACCEPTED') {
      return NextResponse.json({ 
        error: 'Lead must be accepted before assigning team',
        current_status: lead.status 
      }, { status: 400 });
    }

    // Verify mechanic exists and belongs to this workshop
    const { data: mechanic, error: mechanicError } = await supabase
      .from('users_login')
      .select('id, name, role, workshop_id')
      .eq('id', mechanic_id)
      .eq('workshop_id', userProfile.workshop_id)
      .eq('role', 'workshop_mechanic')
      .single();

    if (mechanicError || !mechanic) {
      return NextResponse.json({ error: 'Invalid mechanic or mechanic not in your workshop' }, { status: 400 });
    }

    // Verify supervisor if provided
    let supervisor = null;
    if (supervisor_id) {
      const { data: supervisorData, error: supervisorError } = await supabase
        .from('users_login')
        .select('id, name, role, workshop_id')
        .eq('id', supervisor_id)
        .eq('workshop_id', userProfile.workshop_id)
        .eq('role', 'workshop_supervisor')
        .single();

      if (supervisorError || !supervisorData) {
        return NextResponse.json({ error: 'Invalid supervisor or supervisor not in your workshop' }, { status: 400 });
      }
      supervisor = supervisorData;
    }

    // Verify pickup boy if provided
    let pickupBoy = null;
    if (pickup_boy_id) {
      const { data: pickupBoyData, error: pickupError } = await supabase
        .from('users_login')
        .select('id, name, role, workshop_id')
        .eq('id', pickup_boy_id)
        .eq('workshop_id', userProfile.workshop_id)
        .eq('role', 'workshop_pickup_boy')
        .single();

      if (pickupError || !pickupBoyData) {
        return NextResponse.json({ error: 'Invalid pickup boy or pickup boy not in your workshop' }, { status: 400 });
      }
      pickupBoy = pickupBoyData;
    }

    const now = new Date().toISOString();

    // Determine next status
    let nextStatus = 'TEAM_ASSIGNED';
    if (lead.pickup_required && pickup_boy_id) {
      nextStatus = 'PICKUP_SCHEDULED';
    }

    // Update lead with team assignments
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        assigned_mechanic_id: mechanic_id,
        mechanic_assigned_at: now,
        assigned_supervisor_id: supervisor_id || null,
        supervisor_assigned_at: supervisor_id ? now : null,
        assigned_pickup_boy_id: pickup_boy_id || null,
        pickup_assigned_at: pickup_boy_id ? now : null,
        assigned_by_workshop_admin_id: userProfile.id,
        status: nextStatus,
        pickup_status: pickup_boy_id ? 'ASSIGNED' : (lead.pickup_required ? 'PENDING' : 'NOT_REQUIRED'),
        internal_notes: notes || null,
        updated_at: now
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error assigning team:', updateError);
      return NextResponse.json({ error: 'Failed to assign team' }, { status: 500 });
    }

    // Log status change in lead_status_history
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: nextStatus,
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Team members assigned by workshop admin',
        notes: `Mechanic: ${mechanic.name}${supervisor ? `, Supervisor: ${supervisor.name}` : ''}${pickupBoy ? `, Pickup Boy: ${pickupBoy.name}` : ''}`
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'TEAM_ASSIGNED',
        description: `Team assigned: Mechanic - ${mechanic.name}`,
        old_status: lead.status,
        new_status: nextStatus,
        metadata: {
          mechanic_id: mechanic_id,
          mechanic_name: mechanic.name,
          supervisor_id: supervisor_id,
          supervisor_name: supervisor?.name,
          pickup_boy_id: pickup_boy_id,
          pickup_boy_name: pickupBoy?.name,
          assigned_by: userProfile.id,
          assigned_at: now
        }
      });

    // Create mechanic assignment record
    await supabase
      .from('mechanic_assignments')
      .insert({
        lead_id: leadId,
        mechanic_id: mechanic_id,
        assigned_by: userProfile.id,
        assigned_at: now,
        status: 'ACTIVE',
        assignment_notes: notes
      });

    // CRITICAL: Create or update mechanic_jobs entry so mechanic can see the job
    // Check if mechanic_jobs record already exists
    const { data: existingJob, error: checkError } = await supabase
      .from('mechanic_jobs')
      .select('id')
      .eq('lead_id', leadId)
      .single();

    if (existingJob) {
      // Update existing record
      const { error: updateJobError } = await supabase
        .from('mechanic_jobs')
        .update({
          mechanic_id: mechanic_id,
          assigned_by: userProfile.id,
          mechanic_status: 'ASSIGNED',
          job_priority: lead.lead_priority || 'NORMAL',
          assigned_at: now,
          updated_at: now,
          work_notes: notes || null
        })
        .eq('id', existingJob.id);

      if (updateJobError) {
        console.error('Error updating mechanic job:', updateJobError);
        return NextResponse.json({ 
          error: 'Failed to update mechanic job',
          details: updateJobError.message 
        }, { status: 500 });
      }
    } else {
      // Create new record
      const { error: mechanicJobError } = await supabase
        .from('mechanic_jobs')
        .insert({
          lead_id: leadId,
          mechanic_id: mechanic_id,
          assigned_by: userProfile.id,
          mechanic_status: 'ASSIGNED',
          job_priority: lead.lead_priority || 'NORMAL',
          assigned_at: now,
          work_notes: notes || null
        });

      if (mechanicJobError) {
        console.error('Error creating mechanic job:', mechanicJobError);
        return NextResponse.json({ 
          error: 'Failed to create mechanic job',
          details: mechanicJobError.message 
        }, { status: 500 });
      }
    }

    // TODO: Send notifications to mechanic, supervisor, pickup boy
    // TODO: Generate OTP if pickup required

    return NextResponse.json({
      success: true,
      message: 'Team assigned successfully',
      lead: updatedLead,
      assignments: {
        mechanic: mechanic,
        supervisor: supervisor,
        pickup_boy: pickupBoy
      },
      next_step: pickup_boy_id 
        ? 'Pickup boy will collect the vehicle from customer'
        : 'Mechanic can start working on the job'
    }, { status: 200 });

  } catch (error) {
    console.error('Error in assign team API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

