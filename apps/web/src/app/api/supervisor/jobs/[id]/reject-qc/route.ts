import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { notifyQCDecision } from '@/lib/notifications';

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

    // Get user profile (users_login is mapped by email/phone; not always same as auth user.id)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, full_name, role_id, roles!inner(role_code)';

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

    // Verify user is supervisor
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_SUPERVISOR') {
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

    // Prevent edits after archival/closure
    if (lead.read_only) {
      return NextResponse.json({
        error: 'Lead is archived/read-only',
        hint: 'This job is closed and cannot be modified'
      }, { status: 400 });
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
        error: 'Job is not ready for QC rejection',
        current_status: lead.status,
        mechanic_completed_at: lead.mechanic_completed_at,
        qc_status: lead.qc_status
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // QC rejected -> REWORK_REQUIRED (as per workflow spec)
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        status: 'REWORK_REQUIRED',
        qc_status: 'FAILED',
        qc_performed_by: userProfile.id,
        qc_performed_at: now,
        qc_notes: reason,
        updated_at: now,
        read_only: false
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error rejecting QC:', updateError);
      return NextResponse.json({ error: 'Failed to reject QC' }, { status: 500 });
    }

    // Update mechanic_jobs table to reset status so mechanic can see it
    const { data: mechanicJob } = await supabase
      .from('mechanic_jobs')
      .select('id, mechanic_id')
      .eq('lead_id', leadId)
      .single();

    if (mechanicJob) {
      await supabase
        .from('mechanic_jobs')
        .update({
          mechanic_status: 'IN_PROGRESS', // Reset to IN_PROGRESS so mechanic can see it
          updated_at: now
        })
        .eq('id', mechanicJob.id);
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
        new_status: 'REWORK_REQUIRED',
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
        new_status: 'REWORK_REQUIRED',
        metadata: {
          supervisor_id: userProfile.id,
          rejected_at: now,
          reason: reason,
          notes: notes,
          failed_items: failed_checklist_items
        }
      });

    // Lead events (analytics/audit trail)
    await supabase.from('lead_events').insert([
      {
        lead_id: leadId,
        event_type: 'QC_REJECTED',
        event_description: `QC rejected: ${reason}`,
        event_data: { reason, notes, failed_checklist_items },
        created_by: userProfile.id,
        created_at: now,
      },
      {
        lead_id: leadId,
        event_type: 'REWORK_REQUIRED',
        event_description: 'Job sent back to mechanic for rework',
        created_by: userProfile.id,
        created_at: now,
      },
    ]);

    // TODO: Send notification to mechanic (job needs rework)
    // TODO: Send notification to workshop admin
    try {
      if (lead.assigned_mechanic_id) {
        await notifyQCDecision(
          leadId,
          lead.lead_number || leadId,
          lead.assigned_mechanic_id,
          false,
          userProfile.full_name || 'Supervisor',
          reason
        );
      }
    } catch (e) {
      console.warn('Notification dispatch failed (non-blocking):', e);
    }

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

