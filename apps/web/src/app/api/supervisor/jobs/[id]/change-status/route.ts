/**
 * Supervisor Change Job Status API
 * Purpose: Allow supervisor to change job status after pickup completion
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createNotification, notifyTelecallerForLead } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const params = await paramsPromise;
    
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

    // Verify user is supervisor
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_SUPERVISOR') {
      return NextResponse.json({ error: 'Forbidden: Supervisor only' }, { status: 403 });
    }

    const leadId = params.id;
    const body = await request.json();
    const { new_status, notes } = body;

    if (!new_status) {
      return NextResponse.json({ error: 'new_status is required' }, { status: 400 });
    }

    // Valid status transitions for supervisor (workflow-aligned)
    const validStatuses = ['IN_PROGRESS', 'REWORK_REQUIRED', 'INSPECTED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_DELIVERY'];
    if (!validStatuses.includes(new_status)) {
      return NextResponse.json({ 
        error: 'Invalid status for supervisor',
        valid_statuses: validStatuses
      }, { status: 400 });
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
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
    }

    // Verify lead is from this workshop
    if (lead.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Job not in your workshop' }, { status: 403 });
    }

    // Validate status transition
    const currentStatus = lead.status;
    let isValidTransition = false;

    // After delivery completion, status is DELIVERED_TO_CUSTOMER (legacy: DELIVERED)
    // Supervisor can change to IN_PROGRESS or INSPECTED
    if ((currentStatus === 'DELIVERED_TO_CUSTOMER' || currentStatus === 'DELIVERED') && (new_status === 'IN_PROGRESS' || new_status === 'INSPECTED')) {
      isValidTransition = true;
    }
    // From IN_PROGRESS to QC_PENDING or QC_APPROVED
    else if (currentStatus === 'IN_PROGRESS' && (new_status === 'QC_PENDING' || new_status === 'QC_APPROVED')) {
      isValidTransition = true;
    }
    // From REWORK_REQUIRED to IN_PROGRESS
    else if (currentStatus === 'REWORK_REQUIRED' && new_status === 'IN_PROGRESS') {
      isValidTransition = true;
    }
    // From INSPECTED to QC_PENDING or QC_APPROVED
    else if (currentStatus === 'INSPECTED' && (new_status === 'QC_PENDING' || new_status === 'QC_APPROVED')) {
      isValidTransition = true;
    }
    // From QC_PENDING to QC_APPROVED or READY_FOR_DELIVERY
    else if (currentStatus === 'QC_PENDING' && (new_status === 'QC_APPROVED' || new_status === 'READY_FOR_DELIVERY')) {
      isValidTransition = true;
    }
    // From QC_APPROVED to READY_FOR_DELIVERY
    else if (currentStatus === 'QC_APPROVED' && new_status === 'READY_FOR_DELIVERY') {
      isValidTransition = true;
    }
    // From WORK_COMPLETED to QC_PENDING or QC_APPROVED
    else if (currentStatus === 'WORK_COMPLETED' && (new_status === 'QC_PENDING' || new_status === 'QC_APPROVED')) {
      isValidTransition = true;
    }

    if (!isValidTransition) {
      return NextResponse.json({ 
        error: 'Invalid status transition',
        current_status: currentStatus,
        requested_status: new_status,
        hint: `Cannot change from ${currentStatus} to ${new_status}`
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update lead status
    const updateData: any = {
      status: new_status,
      updated_at: now
    };

    // Set specific timestamps based on status
    if (new_status === 'IN_PROGRESS') {
      updateData.mechanic_started_at = now;
    } else if (new_status === 'QC_APPROVED') {
      updateData.qc_status = 'PASSED';
      updateData.qc_performed_by = userProfile.id;
      updateData.qc_performed_at = now;
    } else if (new_status === 'READY_FOR_DELIVERY') {
      updateData.ready_for_delivery_at = now;
      updateData.marked_ready_by = userProfile.id;
    }

    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating lead status:', updateError);
      return NextResponse.json({ 
        error: 'Failed to change status',
        details: updateError.message
      }, { status: 500 });
    }

    // Log status change in lead_status_history
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: currentStatus,
        new_status: new_status,
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Status changed by supervisor',
        notes: notes || `Status changed from ${currentStatus} to ${new_status}`
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'STATUS_CHANGED',
        description: `Supervisor changed status from ${currentStatus} to ${new_status}`,
        old_status: currentStatus,
        new_status: new_status,
        metadata: {
          supervisor_id: userProfile.id,
          changed_at: now,
          notes: notes
        }
      });

    // Log supervisor action
    await supabase
      .from('supervisor_actions')
      .insert({
        supervisor_id: userProfile.id,
        lead_id: leadId,
        action_type: 'STATUS_CHANGED',
        action_description: `Changed job status from ${currentStatus} to ${new_status}`,
        action_data: { 
          old_status: currentStatus, 
          new_status: new_status,
          notes: notes
        },
        created_at: now
      });

    // Update mechanic_jobs if status is IN_PROGRESS
    if (new_status === 'IN_PROGRESS' && lead.assigned_mechanic_id) {
      await supabase
        .from('mechanic_jobs')
        .update({
          mechanic_status: 'IN_PROGRESS',
          started_at: now,
          updated_at: now
        })
        .eq('lead_id', leadId)
        .eq('mechanic_id', lead.assigned_mechanic_id);
    }

    // Mechanic notification (job reopened / rework required)
    try {
      const leadNumber = (lead as any)?.lead_number || leadId;
      const mechanicId = (lead as any)?.assigned_mechanic_id as string | null | undefined;

      if (mechanicId) {
        // Reopened after delivery
        const reopenedFromDelivered =
          (currentStatus === 'DELIVERED_TO_CUSTOMER' || currentStatus === 'DELIVERED') &&
          (new_status === 'IN_PROGRESS' || new_status === 'INSPECTED');

        if (reopenedFromDelivered) {
          await createNotification({
            userId: mechanicId,
            type: 'SYSTEM_ALERT',
            title: 'Job reopened',
            message: `Lead ${leadNumber} reopened by supervisor. Reason: ${notes || 'Customer follow-up/issue'}.`,
            priority: 'HIGH',
            leadId,
            leadNumber,
            actionUrl: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`,
            metadata: { kind: 'JOB_REOPENED', from_status: currentStatus, to_status: new_status },
          });
        }

        if (new_status === 'REWORK_REQUIRED') {
          await createNotification({
            userId: mechanicId,
            type: 'QC_REJECTED',
            title: 'Rework required',
            message: `Lead ${leadNumber}: rework required. ${notes || 'Please check supervisor notes.'}`,
            priority: 'URGENT',
            leadId,
            leadNumber,
            actionUrl: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`,
            metadata: { kind: 'REWORK_REQUIRED', from_status: currentStatus, to_status: new_status },
          });
        }
      }

      // Notify telecaller when status changes to IN_PROGRESS or IN_SERVICE
      if (new_status === 'IN_PROGRESS' || new_status === 'IN_SERVICE') {
        await notifyTelecallerForLead({
          leadId,
          leadNumber,
          type: 'LEAD_IN_SERVICE',
          title: 'Lead in service',
          message: `Lead ${leadNumber} is now ${new_status === 'IN_PROGRESS' ? 'in progress' : 'in service'}.`,
          priority: 'MEDIUM',
          metadata: { new_status, previous_status: currentStatus },
        });
      }

      // Notify telecaller when status changes to READY_FOR_DELIVERY
      if (new_status === 'READY_FOR_DELIVERY') {
        await notifyTelecallerForLead({
          leadId,
          leadNumber,
          type: 'SYSTEM_ALERT',
          title: 'Vehicle ready for delivery',
          message: `Lead ${leadNumber} is ready for customer delivery. Coordinate with customer for pickup.`,
          priority: 'HIGH',
          metadata: { new_status, previous_status: currentStatus, kind: 'READY_FOR_DELIVERY' },
        });
      }
    } catch (e) {
      console.warn('Status-change notification failed (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      message: `Status changed from ${currentStatus} to ${new_status}`,
      lead: updatedLead,
      next_step: getNextStep(new_status)
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in change status API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

function getNextStep(status: string): string {
  switch (status) {
    case 'IN_PROGRESS':
      return 'Mechanic can start working on the job';
    case 'INSPECTED':
      return 'Job inspected, ready for QC';
    case 'QC_PENDING':
      return 'Awaiting quality check approval';
    case 'QC_APPROVED':
      return 'QC approved, ready for billing';
    case 'READY_FOR_DELIVERY':
      return 'Job ready for delivery to customer';
    default:
      return 'Status updated';
  }
}

