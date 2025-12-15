import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { notifyQCDecision, notifyAccountsTeam } from '@/lib/notifications';

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
    const { notes, checklist_data, quality_score } = body;

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

    // Verify lead is ready for QC (mechanic has completed work / rework resubmitted)
    // IMPORTANT: After QC rejection we set qc_status=FAILED and lead.status=REWORK_REQUIRED.
    // QC approval must only be allowed after mechanic re-completes (WORK_COMPLETED) OR mechanic_job is COMPLETED.
    const { data: mechanicJob } = await supabase
      .from('mechanic_jobs')
      .select('mechanic_status')
      .eq('lead_id', leadId)
      .maybeSingle();

    const readyByLeadStatus = ['WORK_COMPLETED', 'QC_PENDING'].includes(lead.status);
    const readyByMechanicStatus = mechanicJob?.mechanic_status === 'COMPLETED';
    // If qc_status is FAILED (rework), ignore stale mechanic_completed_at from prior completion.
    const readyByTimestamp = !!lead.mechanic_completed_at && lead.qc_status !== 'FAILED';

    const isReadyForQC = readyByLeadStatus || readyByMechanicStatus || readyByTimestamp;

    if (!isReadyForQC) {
      return NextResponse.json(
        {
          error: 'Job is not ready for QC approval',
          current_status: lead.status,
          qc_status: lead.qc_status,
          mechanic_completed_at: lead.mechanic_completed_at,
          mechanic_status: mechanicJob?.mechanic_status || null,
          ready_checks: {
            readyByLeadStatus,
            readyByMechanicStatus,
            readyByTimestamp,
          },
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Update lead status to QC_APPROVED (QC passed)
    const { data: qcApprovedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        status: 'QC_APPROVED',
        qc_status: 'PASSED',
        qc_performed_by: userProfile.id,
        qc_performed_at: now,
        qc_notes: notes || 'Quality check approved',
        updated_at: now
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error approving QC:', updateError);
      return NextResponse.json({ 
        error: 'Failed to approve QC', 
        details: updateError.message,
        code: updateError.code,
        hint: updateError.hint
      }, { status: 500 });
    }

    // Create/Update QC check record
    await supabase
      .from('qc_checks')
      .upsert({
        lead_id: leadId,
        supervisor_id: userProfile.id,
        qc_status: 'PASSED',
        images_verified: true,
        parts_verified: true,
        mechanic_notes_approved: true,
        checklist_data: checklist_data || {},
        supervisor_notes: notes || 'Quality check passed',
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
        new_status: 'QC_APPROVED',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Quality check approved by supervisor',
        notes: notes || 'All checks passed'
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'QC_APPROVED',
        description: 'Supervisor approved quality check',
        old_status: lead.status,
        new_status: 'QC_APPROVED',
        metadata: {
          supervisor_id: userProfile.id,
          approved_at: now,
          notes: notes,
          quality_score: quality_score,
          checklist_data: checklist_data
        }
      });

    // Check if audit is required
    let nextStep = 'Job ready for billing/invoice generation';
    let finalLeadStatus: string = 'READY_FOR_BILLING';
    if (lead.audit_required) {
      await supabase
        .from('service_leads')
        .update({
          status: 'AUDIT_PENDING',
          audit_status: 'PENDING',
          updated_at: now
        })
        .eq('id', leadId);

      finalLeadStatus = 'AUDIT_PENDING';
      nextStep = 'Job sent to auditor for final verification';
    } else {
      // Move to invoice generation - Update status to READY_FOR_BILLING
      await supabase
        .from('service_leads')
        .update({
          status: 'READY_FOR_BILLING',
          updated_at: now
        })
        .eq('id', leadId);
      
      // Log status change to READY_FOR_BILLING
      await supabase
        .from('lead_status_history')
        .insert({
          lead_id: leadId,
          old_status: 'QC_APPROVED',
          new_status: 'READY_FOR_BILLING',
          changed_by: userProfile.id,
          changed_at: now,
          reason: 'QC approved - ready for billing/invoice generation',
          notes: 'Job passed QC and is now ready for billing team to generate invoice'
        });
    }

    // Lead events (analytics/audit trail)
    await supabase.from('lead_events').insert([
      {
        lead_id: leadId,
        event_type: 'QC_APPROVED',
        event_description: 'Supervisor approved QC',
        event_data: { quality_score, checklist_data, notes },
        created_by: userProfile.id,
        created_at: now,
      },
      {
        lead_id: leadId,
        event_type: finalLeadStatus,
        event_description: finalLeadStatus === 'AUDIT_PENDING'
          ? 'Lead sent for audit after QC approval'
          : 'Lead ready for billing after QC approval',
        created_by: userProfile.id,
        created_at: now,
      },
    ]);

    // TODO: Send notification to workshop admin
    // TODO: Send notification to billing team
    // TODO: Send notification to auditor (if audit required)
    try {
      // Notify mechanic about QC decision
      if (lead.assigned_mechanic_id) {
        await notifyQCDecision(
          leadId,
          lead.lead_number || leadId,
          lead.assigned_mechanic_id,
          true,
          userProfile.full_name || 'Supervisor',
          notes
        );
      }

      // Notify accounts team when billing is ready (no audit)
      if (finalLeadStatus === 'READY_FOR_BILLING') {
        await notifyAccountsTeam(
          lead.workshop_id,
          leadId,
          lead.lead_number || leadId,
          'Ready for Billing',
          `QC approved for lead ${lead.lead_number || leadId}. Please generate invoice.`,
          `/dashboard/billing/leads/${leadId}/generate-invoice`,
          'HIGH'
        );
      }
    } catch (e) {
      console.warn('Notification dispatch failed (non-blocking):', e);
    }

    // Fetch final lead snapshot (after workflow transition)
    const { data: finalLead } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Quality check approved successfully',
      lead: finalLead || qcApprovedLead,
      next_step: nextStep,
      quality_score: quality_score
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in approve QC API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error?.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

