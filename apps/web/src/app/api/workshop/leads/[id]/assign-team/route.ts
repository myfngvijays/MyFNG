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

    // Get user profile - use user.id instead of email for more reliable lookup
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, full_name, email, role_id, workshop_id, roles(role_code, role_name)')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json({ 
        error: 'User profile lookup failed',
        details: profileError.message 
      }, { status: 500 });
    }

    if (!userProfile) {
      return NextResponse.json({ 
        error: 'User profile not found. Please ensure your account is properly set up.',
        user_id: user.id,
        user_email: user.email
      }, { status: 404 });
    }

    // Verify user is workshop admin or supervisor - check role_code from joined roles table
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_ADMIN' && roleCode !== 'WORKSHOP_SUPERVISOR') {
      return NextResponse.json({ 
        error: 'Forbidden: Workshop Admin or Supervisor only',
        current_role: roleCode
      }, { status: 403 });
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

    // Verify lead is in ACCEPTED status (or allow other statuses for reassignment)
    const allowedStatuses = ['ACCEPTED', 'TEAM_ASSIGNED', 'PICKUP_SCHEDULED', 'PICKUP_ASSIGNED', 'PICKUP_IN_PROGRESS', 'PICKUP_COMPLETED', 'DELIVERED'];
    if (!allowedStatuses.includes(lead.status)) {
      // Don't block - allow reassignment even if status is not ideal
    }

    // Verify mechanic exists and belongs to this workshop
    const { data: mechanic, error: mechanicError } = await supabase
      .from('users_login')
      .select('id, full_name, email, role_id, workshop_id, roles(role_code, role_name)')
      .eq('id', mechanic_id)
      .eq('workshop_id', userProfile.workshop_id)
      .maybeSingle();

    if (mechanicError) {
      console.error('Error fetching mechanic:', mechanicError);
      return NextResponse.json({ error: 'Failed to verify mechanic' }, { status: 500 });
    }

    if (!mechanic) {
      return NextResponse.json({ error: 'Invalid mechanic or mechanic not in your workshop' }, { status: 400 });
    }

    const mechanicRoleCode = (mechanic.roles as any)?.role_code;
    if (mechanicRoleCode !== 'WORKSHOP_MECHANIC') {
      return NextResponse.json({ error: 'Selected user is not a mechanic' }, { status: 400 });
    }

    // Verify supervisor if provided
    let supervisor = null;
    if (supervisor_id) {
      const { data: supervisorData, error: supervisorError } = await supabase
        .from('users_login')
        .select('id, full_name, email, role_id, workshop_id, roles(role_code, role_name)')
        .eq('id', supervisor_id)
        .eq('workshop_id', userProfile.workshop_id)
        .maybeSingle();

      if (supervisorError) {
        console.error('Error fetching supervisor:', supervisorError);
        return NextResponse.json({ error: 'Failed to verify supervisor' }, { status: 500 });
      }

      if (!supervisorData) {
        return NextResponse.json({ error: 'Invalid supervisor or supervisor not in your workshop' }, { status: 400 });
      }

      const supervisorRoleCode = (supervisorData.roles as any)?.role_code;
      if (supervisorRoleCode !== 'WORKSHOP_SUPERVISOR') {
        return NextResponse.json({ error: 'Selected user is not a supervisor' }, { status: 400 });
      }

      supervisor = supervisorData;
    }

    // Verify pickup boy if provided
    let pickupBoy = null;
    if (pickup_boy_id) {
      const { data: pickupBoyData, error: pickupError } = await supabase
        .from('users_login')
        .select('id, full_name, email, role_id, workshop_id, roles(role_code, role_name)')
        .eq('id', pickup_boy_id)
        .eq('workshop_id', userProfile.workshop_id)
        .maybeSingle();

      if (pickupError) {
        console.error('Error fetching pickup boy:', pickupError);
        return NextResponse.json({ error: 'Failed to verify pickup boy' }, { status: 500 });
      }

      if (!pickupBoyData) {
        return NextResponse.json({ error: 'Invalid pickup boy or pickup boy not in your workshop' }, { status: 400 });
      }

      const pickupBoyRoleCode = (pickupBoyData.roles as any)?.role_code;
      if (pickupBoyRoleCode !== 'WORKSHOP_PICKUP_BOY') {
        return NextResponse.json({ error: 'Selected user is not a pickup boy' }, { status: 400 });
      }

      pickupBoy = pickupBoyData;
    }

    const now = new Date().toISOString();

    // Determine next status
    // TEAM_ASSIGNED and PICKUP_SCHEDULED are not valid lead_status enum values
    // We should keep the current status (likely ACCEPTED)
    let nextStatus = lead.status;
    
    // If explicitly needed, we could ensure it is at least ACCEPTED
    if (nextStatus === 'NEW' || nextStatus === 'ASSIGNED') {
      nextStatus = 'ACCEPTED';
    }
    
    // Update lead with team assignments
    
    const updatePayload = {
      assigned_mechanic_id: mechanic_id,
      mechanic_assigned_at: now,
      assigned_supervisor_id: supervisor_id || null,
      supervisor_assigned_at: supervisor_id ? now : null,
      assigned_pickup_boy_id: pickup_boy_id || null,
      pickup_assigned_at: pickup_boy_id ? now : null,
      assigned_by_workshop_admin_id: roleCode === 'WORKSHOP_ADMIN' ? userProfile.id : null,
      status: nextStatus,
      pickup_status: pickup_boy_id ? 'ASSIGNED' : (lead.pickup_required ? 'PENDING' : 'NOT_REQUIRED'),
      internal_notes: notes || null,
      updated_at: now
    };
    
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update(updatePayload)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating service_leads:', updateError);
      return NextResponse.json({ 
        error: 'Failed to assign team',
        details: updateError.message,
        code: updateError.code,
        hint: updateError.hint
      }, { status: 500 });
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
        reason: roleCode === 'WORKSHOP_ADMIN' 
          ? 'Team members assigned by workshop admin'
          : 'Team members assigned by workshop supervisor',
        notes: `Mechanic: ${mechanic.full_name}${supervisor ? `, Supervisor: ${supervisor.full_name}` : ''}${pickupBoy ? `, Pickup Boy: ${pickupBoy.full_name}` : ''}`
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'TEAM_ASSIGNED',
        description: `Team assigned: Mechanic - ${mechanic.full_name}`,
        old_status: lead.status,
        new_status: nextStatus,
        metadata: {
          mechanic_id: mechanic_id,
          mechanic_name: mechanic.full_name,
          supervisor_id: supervisor_id,
          supervisor_name: supervisor?.full_name,
          pickup_boy_id: pickup_boy_id,
          pickup_boy_name: pickupBoy?.full_name,
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
      .select('id, mechanic_id, mechanic_status')
      .eq('lead_id', leadId)
      .maybeSingle(); // Use maybeSingle to avoid error when no record exists

    if (checkError) {
      console.error('Error checking existing job:', checkError);
    }

    if (existingJob) {
      // Update existing record
      const updateData = {
        mechanic_id: mechanic_id,
        assigned_by: userProfile.id,
        mechanic_status: 'ASSIGNED',
        job_priority: lead.lead_priority || 'NORMAL',
        assigned_at: now,
        updated_at: now,
        work_notes: notes || null
      };
      
      const { data: updatedJob, error: updateJobError } = await supabase
        .from('mechanic_jobs')
        .update(updateData)
        .eq('id', existingJob.id)
        .select();

      if (updateJobError) {
        console.error('Error updating mechanic job:', updateJobError);
        return NextResponse.json({ 
          error: 'Failed to update mechanic job',
          details: updateJobError.message 
        }, { status: 500 });
      }
      
    } else {
      // Create new record
      const insertData = {
        lead_id: leadId,
        mechanic_id: mechanic_id,
        assigned_by: userProfile.id,
        mechanic_status: 'ASSIGNED',
        job_priority: lead.lead_priority || 'NORMAL',
        assigned_at: now,
        work_notes: notes || null
      };
      
      const { data: newJob, error: mechanicJobError } = await supabase
        .from('mechanic_jobs')
        .insert(insertData)
        .select();

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

  } catch (error: any) {
    console.error('Unexpected error in assign-team API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error?.message || 'Unknown error',
      type: typeof error
    }, { status: 500 });
  }
}

