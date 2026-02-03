import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

/**
 * POST /api/leads/[id]/qc-status
 * 
 * Update QC status for a lead (Supervisor action)
 * 
 * Body:
 * - qc_status: 'PASSED' or 'FAILED'
 * - checklist_data: Object with 10 checklist items
 * - notes: QC notes
 * - failed_reason: Required if status is FAILED
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to verify supervisor role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('role_id, workshop_id, full_name, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify supervisor role
    const roleCode = (userProfile.roles as any)?.role_code;
    if (!['WORKSHOP_SUPERVISOR', 'WORKSHOP_ADVISOR', 'WORKSHOP_ADVISER'].includes(String(roleCode || ''))) {
      return NextResponse.json({ error: 'Forbidden: Supervisor role required' }, { status: 403 });
    }

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    const { qc_status, checklist_data, notes, failed_reason } = await request.json();

    if (!qc_status || !['PASSED', 'FAILED'].includes(qc_status)) {
      return NextResponse.json({ error: 'Invalid qc_status. Must be PASSED or FAILED' }, { status: 400 });
    }

    if (qc_status === 'FAILED' && (!failed_reason || failed_reason.trim() === '')) {
      return NextResponse.json({ error: 'failed_reason is required when QC fails' }, { status: 400 });
    }

    if (!checklist_data || typeof checklist_data !== 'object') {
      return NextResponse.json({ error: 'checklist_data is required' }, { status: 400 });
    }

    // Fetch the lead
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, workshop_id, status, lead_number')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Verify workshop ownership
    if (lead.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Forbidden: Lead belongs to different workshop' }, { status: 403 });
    }

    // Verify lead is ready for QC (mechanic has completed work)
    // NOTE: "WORK_COMPLETED" is the canonical mechanic-done state.
    if (lead.status !== 'WORK_COMPLETED' && lead.status !== 'QC_PENDING') {
      return NextResponse.json({ 
        error: 'QC can only be performed on work-completed jobs',
        current_status: lead.status,
        allowed_statuses: ['WORK_COMPLETED', 'QC_PENDING'],
      }, { status: 400 });
    }

    // Validate checklist data has all required fields
    const requiredFields = [
      'before_images_uploaded',
      'progress_images_uploaded',
      'after_images_uploaded',
      'all_parts_documented',
      'service_completed_as_requested',
      'no_additional_issues',
      'car_cleaned',
      'test_drive_completed',
      'no_warning_lights',
      'documents_ready'
    ];

    for (const field of requiredFields) {
      if (!(field in checklist_data)) {
        return NextResponse.json({ 
          error: `Missing required checklist field: ${field}` 
        }, { status: 400 });
      }
    }

    // Create or update QC check record
    const { data: existingQC } = await supabase
      .from('qc_checks')
      .select('id')
      .eq('lead_id', leadId)
      .single();

    const qcData = {
      lead_id: leadId,
      supervisor_id: user.id,
      qc_status: qc_status,
      checklist_data: checklist_data,
      images_verified: checklist_data.before_images_uploaded && 
                       checklist_data.progress_images_uploaded && 
                       checklist_data.after_images_uploaded,
      parts_verified: checklist_data.all_parts_documented,
      mechanic_notes_approved: true,
      supervisor_notes: notes || null,
      failed_reason: qc_status === 'FAILED' ? failed_reason : null,
      updated_at: new Date().toISOString()
    };

    if (existingQC) {
      // Update existing QC check
      await supabase
        .from('qc_checks')
        .update(qcData)
        .eq('id', existingQC.id);
    } else {
      // Create new QC check
      await supabase
        .from('qc_checks')
        .insert(qcData);
    }

    // Update lead status based on QC result
    if (qc_status === 'PASSED') {
      // Move to READY_FOR_BILLING (billing must happen after QC)
      await supabase
        .from('service_leads')
        .update({
          status: 'READY_FOR_BILLING',
          qc_status: 'PASSED',
          qc_performed_by: user.id,
          qc_performed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      // Log activity
      await supabase.from('lead_events').insert({
        lead_id: leadId,
        event_type: 'QC_PASSED',
        event_description: `QC passed by supervisor ${userProfile.full_name}. Job ready for billing.`,
        created_by: user.id
      });
    } else {
      // QC Failed - send back to mechanic
      await supabase
        .from('service_leads')
        .update({
          status: 'IN_PROGRESS', // Send back to mechanic
          qc_status: 'FAILED',
          qc_performed_by: user.id,
          qc_performed_at: new Date().toISOString(),
          qc_notes: failed_reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      // Log activity
      await supabase.from('lead_events').insert({
        lead_id: leadId,
        event_type: 'QC_FAILED',
        event_description: `QC failed by supervisor ${userProfile.full_name}. Reason: ${failed_reason}. Job sent back to mechanic.`,
        created_by: user.id,
        event_data: {
          failed_reason: failed_reason,
          notes: notes
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `QC ${qc_status.toLowerCase()} successfully`,
      data: {
        leadId,
        leadNumber: lead.lead_number,
        qcStatus: qc_status,
        newLeadStatus: qc_status === 'PASSED' ? 'READY_FOR_BILLING' : 'IN_PROGRESS'
      }
    });

  } catch (error: any) {
    console.error('QC status API error:', error);
    return NextResponse.json(
      { error: 'Failed to update QC status', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leads/[id]/qc-status
 * 
 * Get QC check details for a lead
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });

    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, workshop_id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Prefer service_role client for lead fetch (avoid RLS false negatives in prod)
    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    const leadReader = supabaseAdmin || supabase;

    const { data: lead, error: leadError } = await leadReader
      .from('service_leads')
      .select('id, workshop_id')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if ((userProfile as any).workshop_id !== (lead as any).workshop_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prefer service_role client for read (bypasses RLS) but only after we validate workshop ownership above.
    const db = leadReader;

    // Fetch QC check
    const { data: qcCheck, error: qcError } = await db
      .from('qc_checks')
      .select(
        `
        *,
        supervisor:supervisor_id(full_name, profile_image)
      `
      )
      .eq('lead_id', leadId)
      .single();

    if (qcError && qcError.code !== 'PGRST116') {
      console.error('Error fetching QC check:', qcError);
      return NextResponse.json(
        {
          error: 'Failed to fetch QC check',
          details: qcError.message,
          using: supabaseAdmin ? 'service_role' : 'anon',
          serviceRoleError: adminErr || null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: qcCheck || null
    });

  } catch (error: any) {
    console.error('Get QC status API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch QC status', details: error.message },
      { status: 500 }
    );
  }
}

