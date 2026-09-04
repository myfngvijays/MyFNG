import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createNotification, notifyWorkshopRoles, notifyTelecallerForLead } from '@/lib/notifications';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  normalizeExtraWorkPartLines,
  supabaseWriteDropUnknownColumns,
} from '@/lib/workshop/extraWorkParts';

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

    const selectProfile = 'id, email, phone, full_name, workshop_id, role_id, roles!inner(role_code)';

    const { data: byEmail, error: byEmailError } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null, error: null };

    const { data: byPhone, error: byPhoneError } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null, error: null };

    const userProfile = byEmail || byPhone;

    if (!userProfile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          user_email: email || null,
          user_phone: phone || null,
          profile_lookup_errors: [byEmailError?.message, byPhoneError?.message].filter(Boolean),
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
    const { description, reason, estimated_cost, category, other_category, category_label, attachment_url, is_urgent } = body;
    const partsLines = normalizeExtraWorkPartLines(body?.parts_breakdown ?? body?.parts ?? body?.items).map((row) => ({
      ...row,
      unit_price: 0,
      amount: 0,
    }));

    if (!description || !reason) {
      return NextResponse.json({ 
        error: 'Description and reason are required' 
      }, { status: 400 });
    }

    const categoryCode = String(category || 'EXTRA_WORK').trim().toUpperCase();
    const otherLabel = String(other_category || category_label || '').trim();
    if (categoryCode === 'OTHER' && !otherLabel) {
      return NextResponse.json(
        { error: 'Please specify the other category' },
        { status: 400 }
      );
    }
    const storedCategory = categoryCode === 'OTHER'
      ? `OTHER: ${otherLabel}`
      : (categoryCode || 'EXTRA_WORK');

    const costNum = estimated_cost === undefined || estimated_cost === null || estimated_cost === ''
      ? 0
      : Number(estimated_cost);
    if (!Number.isFinite(costNum) || costNum < 0) {
      return NextResponse.json(
        {
          error: 'Estimated cost must be a valid number (>= 0)',
        },
        { status: 400 }
      );
    }
    if (costNum <= 0 && partsLines.length === 0) {
      return NextResponse.json(
        { error: 'Add estimated cost or list the parts/labour used (pricing optional)' },
        { status: 400 }
      );
    }

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
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
    }

    // Lock editing after QC approval / billing lock (NEW FLOW)
    if (lead.billing_locked_at) {
      return NextResponse.json(
        {
          error: 'Edits are locked after QC approval',
          hint: 'After QC Approved, mechanic cannot add/edit parts or labour. Ask workshop manager/supervisor.',
          billing_locked_at: lead.billing_locked_at,
        },
        { status: 400 }
      );
    }

    const lockedLeadStatuses = [
      'QC_APPROVED',
      'READY_FOR_BILLING',
      'PAYMENT_AWAITING',
      'INVOICE_GENERATED',
      'AWAITING_PAYMENT',
      'PAID',
      'READY_FOR_DELIVERY',
      'DELIVERED_TO_CUSTOMER',
      'DELIVERED',
      'CLOSED',
    ];
    if (lockedLeadStatuses.includes(lead.status)) {
      return NextResponse.json(
        {
          error: 'Job is locked in billing/payment stage',
          current_status: lead.status,
          hint: 'Mechanic cannot request extra work after QC/billing stages. Ask workshop manager/supervisor.',
        },
        { status: 400 }
      );
    }

    // Verify lead is assigned to this mechanic
    if (lead.assigned_mechanic_id !== userProfile.id) {
      return NextResponse.json({ error: 'Job not assigned to you' }, { status: 403 });
    }

    // Verify job is in a workable state.
    // IMPORTANT: In this codebase, service_leads.status may not immediately change when mechanic starts.
    // So we also trust mechanic_jobs.mechanic_status for validation.
    const allowedLeadStatuses = ['IN_PROGRESS', 'MECHANIC_WORKING', 'REWORK_REQUIRED', 'ON_HOLD'];
    const allowedMechanicStatuses = ['IN_PROGRESS', 'HOLD', 'ON_HOLD'];

    const { data: currentJobForGate } = await supabase
      .from('mechanic_jobs')
      .select('id, mechanic_status')
      .eq('lead_id', leadId)
      .eq('mechanic_id', userProfile.id)
      .maybeSingle();

    const leadOk = allowedLeadStatuses.includes(lead.status);
    const mechanicOk = allowedMechanicStatuses.includes(String(currentJobForGate?.mechanic_status || ''));

    if (!leadOk && !mechanicOk) {
      return NextResponse.json(
        {
          error: 'Job must be started (in progress) to request additional job',
          allowed_lead_statuses: allowedLeadStatuses,
          current_lead_status: lead.status,
          allowed_mechanic_statuses: allowedMechanicStatuses,
          current_mechanic_status: currentJobForGate?.mechanic_status || null,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    // users_login.id != auth.uid(), so JWT RLS blocks mechanic inserts on lead_extra_charges.
    const { supabaseAdmin } = getSupabaseAdmin();
    const writer = supabaseAdmin || supabase;

    // Create additional job request
    const insertPayload: Record<string, unknown> = {
        lead_id: leadId,
        description: description,
        reason: reason,
        amount: costNum,
        oem_price: costNum,
        oes_price: 0,
        labour_price: 0,
        part_price_type: 'OEM',
        category: storedCategory,
        attachment_url: attachment_url,
        is_urgent: is_urgent || false,
        status: 'PENDING',
        requested_by: userProfile.id,
        approval_requested_at: now,
        created_at: now,
        parts_breakdown: partsLines,
    };
    const { data: extraWorkRequest, error: insertError } = await supabaseWriteDropUnknownColumns(
      writer,
      'lead_extra_charges',
      'insert',
      insertPayload,
      { select: '*' },
    );

    if (insertError || !extraWorkRequest) {
      console.error('Error creating additional job request:', insertError);
      return NextResponse.json(
        {
          error: 'Failed to create additional job request',
          details: insertError?.message,
          code: insertError?.code,
        },
        { status: 500 }
      );
    }

    // Create activity log
    await writer
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'EXTRA_WORK_REQUESTED',
        description: `Mechanic requested additional job: ${description}`,
        metadata: {
          mechanic_id: userProfile.id,
          extra_work_id: extraWorkRequest.id,
          description: description,
          reason: reason,
          estimated_cost: costNum,
          parts_breakdown: partsLines,
          category: storedCategory,
          other_category: categoryCode === 'OTHER' ? otherLabel : undefined,
          is_urgent: is_urgent,
          requested_at: now
        }
      });

    // Put job on HOLD so all screens show consistent state
    // - mechanic_jobs.mechanic_status = HOLD
    // - service_leads.status = ON_HOLD (lead workflow status)
    try {
      const { data: currentJob } = await writer
        .from('mechanic_jobs')
        .select('id, mechanic_status')
        .eq('lead_id', leadId)
        .eq('mechanic_id', userProfile.id)
        .maybeSingle();

      await writer
        .from('mechanic_jobs')
        .update({
          mechanic_status: 'HOLD',
          has_pending_extra_work: true,
          paused_at: now,
          updated_at: now,
        })
        .eq('lead_id', leadId)
        .eq('mechanic_id', userProfile.id);

      if (currentJob) {
        // Create mechanic action log (best-effort)
        await writer.from('mechanic_actions_log').insert({
          lead_id: leadId,
          mechanic_id: userProfile.id,
          action_type: 'STATUS_CHANGED',
          action_description: `Status changed from ${currentJob.mechanic_status} to HOLD (additional job requested)`,
          metadata: {
            old_status: currentJob.mechanic_status,
            new_status: 'HOLD',
            reason: 'EXTRA_WORK_REQUESTED',
            extra_work_id: extraWorkRequest.id,
          },
        });
      }

      // Update service_leads status + history (best-effort)
      if (lead.status !== 'ON_HOLD') {
        await writer
          .from('service_leads')
          .update({ status: 'ON_HOLD', updated_at: now })
          .eq('id', leadId);

        await writer.from('lead_status_history').insert({
          lead_id: leadId,
          old_status: lead.status,
          new_status: 'ON_HOLD',
          changed_by: userProfile.id,
          changed_at: now,
          reason: 'Additional job requested',
          notes: `Additional job requested: ${description}`,
        });
      }
    } catch (e) {
      // Don't fail request creation if status updates are blocked; UI can still show request.
      console.error('Failed to set HOLD after additional job request:', e);
    }

    // In-app notifications (Phase A)
    try {
      const leadNumber = (lead as any)?.lead_number || leadId;
      const mechanicName = (userProfile as any)?.full_name || 'Mechanic';
      const priority = is_urgent ? 'HIGH' : 'MEDIUM';
      const msg = `Extra work requested for lead ${leadNumber}: ${description} (₹${costNum}).`;

      if ((lead as any)?.assigned_supervisor_id) {
        await createNotification({
          userId: (lead as any).assigned_supervisor_id,
          type: 'EXTRA_WORK_REQUESTED',
          title: 'Extra work requested',
          message: msg,
          priority,
          leadId,
          leadNumber,
          relatedUserName: mechanicName,
          actionUrl: `/dashboard/workshop-advisor/extra-work`,
          metadata: { extra_work_id: extraWorkRequest.id, amount: costNum, is_urgent: Boolean(is_urgent) },
        });
      }

      if ((lead as any)?.workshop_id) {
        await notifyWorkshopRoles({
          workshopId: (lead as any).workshop_id,
          roleCodes: ['WORKSHOP_ADMIN'],
          type: 'EXTRA_WORK_REQUESTED',
          title: 'Extra work requested',
          message: msg,
          priority: is_urgent ? 'HIGH' : 'LOW',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_admin/leads/pending`,
          metadata: { extra_work_id: extraWorkRequest.id, amount: costNum, is_urgent: Boolean(is_urgent) },
        });
      }

      // Notify telecaller about extra work request
      await notifyTelecallerForLead({
        leadId,
        leadNumber,
        type: 'EXTRA_WORK_REQUESTED',
        title: 'Extra work requested',
        message: `Additional work requested for lead ${leadNumber}: ${description} (₹${costNum})${is_urgent ? ' [URGENT]' : ''}.`,
        priority: is_urgent ? 'HIGH' : 'MEDIUM',
        metadata: { extra_work_id: extraWorkRequest.id, amount: costNum, is_urgent: Boolean(is_urgent) },
      });
    } catch (e) {
      console.warn('Extra work request notifications failed (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      message: 'Additional job request submitted successfully',
      extra_work_request: extraWorkRequest,
      next_step: lead.assigned_supervisor_id 
        ? 'Supervisor will review and approve/reject your request'
        : 'Workshop Admin will review and approve/reject your request',
      status: 'PENDING_APPROVAL',
      job_status: 'HOLD',
      lead_status: 'ON_HOLD'
    }, { status: 201 });

  } catch (error) {
    console.error('Error in request additional job API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, full_name, workshop_id, role_id, roles!inner(role_code)';

    const { data: byEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };

    const { data: byPhone } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };

    const userProfile = byEmail || byPhone;
    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const allowedRoles = ['WORKSHOP_MECHANIC', 'WORKSHOP_SUPERVISOR', 'WORKSHOP_ADMIN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const reader = supabaseAdmin || supabase;

    if (roleCode === 'WORKSHOP_MECHANIC') {
      const { data: jobRow } = await reader
        .from('mechanic_jobs')
        .select('id')
        .eq('lead_id', leadId)
        .eq('mechanic_id', userProfile.id)
        .maybeSingle();
      const { data: lead } = await reader
        .from('service_leads')
        .select('assigned_mechanic_id')
        .eq('id', leadId)
        .maybeSingle();
      if (!jobRow && lead?.assigned_mechanic_id !== userProfile.id) {
        return NextResponse.json({ error: 'Job not assigned to you' }, { status: 403 });
      }
    }

    const { data: rows, error } = await reader
      .from('lead_extra_charges')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to load additional job requests', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      requests: rows || [],
      pending_count: (rows || []).filter((r: any) => String(r.status || '').toUpperCase() === 'PENDING').length,
    });
  } catch (error) {
    console.error('Error listing additional job requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

