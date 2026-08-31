import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notifications';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { mapLeadPriorityToJobPriority } from '@/lib/workshop/jobPriority';
import { ensureLeadServiceChecklist } from '@/lib/workshop/ensureServiceChecklist';

const ADVISOR_ROLES = new Set(['WORKSHOP_SUPERVISOR', 'WORKSHOP_ADMIN']);

/**
 * POST /api/leads/[id]/assign-mechanic
 *
 * Assign a mechanic to a lead (Workshop Advisor / Admin action)
 */
export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('role_id, workshop_id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as { role_code?: string })?.role_code;
    if (!roleCode || !ADVISOR_ROLES.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden: Advisor role required' }, { status: 403 });
    }

    const leadId = params.id;
    const { mechanic_id, notes } = await request.json();

    if (!mechanic_id) {
      return NextResponse.json({ error: 'mechanic_id is required' }, { status: 400 });
    }

    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, lead_number, workshop_id, status, assigned_mechanic_id, priority')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Forbidden: Lead belongs to different workshop' }, { status: 403 });
    }

    const { data: mechanic, error: mechanicError } = await supabase
      .from('users_login')
      .select('id, workshop_id, full_name, roles!inner(role_code)')
      .eq('id', mechanic_id)
      .single();

    if (mechanicError || !mechanic) {
      return NextResponse.json({ error: 'Mechanic not found' }, { status: 404 });
    }

    if ((mechanic.roles as { role_code?: string })?.role_code !== 'WORKSHOP_MECHANIC') {
      return NextResponse.json({ error: 'User is not a mechanic' }, { status: 400 });
    }

    if (mechanic.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Mechanic belongs to different workshop' }, { status: 400 });
    }

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminErr || 'Server configuration error' }, { status: 500 });
    }

    const now = new Date().toISOString();
    const jobPriority = mapLeadPriorityToJobPriority(lead.priority);

    const { error: updateError } = await supabaseAdmin
      .from('service_leads')
      .update({
        assigned_mechanic_id: mechanic_id,
        mechanic_assigned_at: now,
        updated_at: now,
      })
      .eq('id', leadId);

    if (updateError) {
      console.error('Error updating lead:', updateError);
      return NextResponse.json({ error: 'Failed to assign mechanic', details: updateError.message }, { status: 500 });
    }

    const { error: assignmentError } = await supabaseAdmin.from('mechanic_assignments').insert({
      lead_id: leadId,
      mechanic_id,
      assigned_by: user.id,
      assignment_notes: notes,
      status: 'ACTIVE',
    });

    if (assignmentError) {
      console.error('Error creating assignment record:', assignmentError);
    }

    const { data: existingJob, error: checkError } = await supabaseAdmin
      .from('mechanic_jobs')
      .select('id, mechanic_id, mechanic_status')
      .eq('lead_id', leadId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing job:', checkError);
    }

    if (existingJob) {
      const { error: updateJobError } = await supabaseAdmin
        .from('mechanic_jobs')
        .update({
          mechanic_id,
          assigned_by: user.id,
          mechanic_status: 'ASSIGNED',
          job_priority: jobPriority,
          assigned_at: now,
          updated_at: now,
          work_notes: notes || null,
        })
        .eq('id', existingJob.id);

      if (updateJobError) {
        console.error('Error updating mechanic job:', updateJobError);
        return NextResponse.json({
          error: 'Failed to update mechanic job',
          details: updateJobError.message,
        }, { status: 500 });
      }
    } else {
      const { error: mechanicJobError } = await supabaseAdmin.from('mechanic_jobs').insert({
        lead_id: leadId,
        mechanic_id,
        assigned_by: user.id,
        mechanic_status: 'ASSIGNED',
        job_priority: jobPriority,
        assigned_at: now,
        work_notes: notes || null,
      });

      if (mechanicJobError) {
        console.error('Error creating mechanic job:', mechanicJobError);
        return NextResponse.json({
          error: 'Failed to create mechanic job',
          details: mechanicJobError.message,
        }, { status: 500 });
      }
    }

    try {
      await ensureLeadServiceChecklist(supabaseAdmin, leadId, mechanic_id);
    } catch (e) {
      console.warn('Checklist ensure failed (non-blocking):', e);
    }

    await supabaseAdmin.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'MECHANIC_ASSIGNED',
      event_description: `Mechanic ${mechanic.full_name} assigned by supervisor`,
      created_by: user.id,
    });

    try {
      const leadNumber = lead.lead_number || leadId;
      await createNotification({
        userId: mechanic_id,
        type: 'JOB_ASSIGNED',
        title: 'New job assigned',
        message: `You have been assigned lead ${leadNumber}. Open Jobs to start.`,
        priority: 'HIGH',
        leadId,
        leadNumber,
        actionUrl: `/dashboard/workshop_mechanic/jobs/${leadId}`,
      });
    } catch (e) {
      console.warn('Mechanic assign notification failed (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      message: 'Mechanic assigned successfully',
      data: {
        leadId,
        mechanicId: mechanic_id,
        mechanicName: mechanic.full_name,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Assign mechanic API error:', error);
    return NextResponse.json(
      { error: 'Failed to assign mechanic', details: message },
      { status: 500 }
    );
  }
}
