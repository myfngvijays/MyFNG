import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveMechanicDisplayStatus } from '@/lib/workshop/mechanicJobStatus';
import { resolveWorkshopUserProfile } from '@/lib/workshop/resolveWorkshopUserProfile';

/** GET /api/mechanic/jobs — list jobs for logged-in mechanic (uses admin to bypass auth.uid RLS mismatch) */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profile, error: profileError } = await resolveWorkshopUserProfile(supabase, user);
    const roleCode = profile?.roles?.role_code;
    if (!profile || roleCode !== 'WORKSHOP_MECHANIC') {
      return NextResponse.json(
        { error: 'Forbidden: Mechanic only', details: profileError },
        { status: 403 },
      );
    }

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminErr || 'Server config error' }, { status: 500 });
    }

    const mechanicId = profile.id;

    const { data: mechanicJobs, error: jobsError } = await supabaseAdmin
      .from('mechanic_jobs')
      .select(`
        *,
        lead:service_leads(
          id,
          lead_number,
          customer_name,
          vehicle_number,
          vehicle_make,
          vehicle_model,
          service_type,
          service_type_ids,
          subservice_ids,
          problem_description,
          status,
          pickup_required,
          pickup_status,
          priority
        )
      `)
      .eq('mechanic_id', mechanicId)
      .order('assigned_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (jobsError) {
      console.error('mechanic jobs list error:', jobsError);
      return NextResponse.json({ error: 'Failed to fetch jobs', details: jobsError.message }, { status: 500 });
    }

    let rows = mechanicJobs || [];

    // Fallback: assigned on service_leads but mechanic_jobs row missing (sync gap)
    if (rows.length === 0) {
      const { data: assignedLeads } = await supabaseAdmin
        .from('service_leads')
        .select(`
          id,
          lead_number,
          customer_name,
          vehicle_number,
          vehicle_make,
          vehicle_model,
          service_type,
          service_type_ids,
          subservice_ids,
          problem_description,
          status,
          pickup_required,
          pickup_status,
          priority,
          mechanic_assigned_at,
          updated_at
        `)
        .eq('assigned_mechanic_id', mechanicId)
        .is('deleted_at', null);

      const activeLeads = (assignedLeads || []).filter((lead: any) => {
        const st = String(lead.status || '').toUpperCase();
        return !['REJECTED', 'CANCELLED', 'CLOSED'].includes(st);
      });

      rows = activeLeads.map((lead: any) => ({
        id: `lead-${lead.id}`,
        lead_id: lead.id,
        mechanic_id: mechanicId,
        mechanic_status: String(lead.status || '').toUpperCase() === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'ASSIGNED',
        job_priority: 'NORMAL',
        assigned_at: lead.mechanic_assigned_at || lead.updated_at,
        started_at: null,
        completed_at: null,
        checklist_completed: false,
        before_images_count: 0,
        progress_images_count: 0,
        after_images_count: 0,
        has_pending_extra_work: false,
        lead,
      }));
    }

    const leadIds = rows.map((r: any) => r.lead_id).filter(Boolean);
    const extraWorkLeadIds = new Set<string>();

    if (leadIds.length > 0) {
      const { data: extraWork } = await supabaseAdmin
        .from('lead_extra_charges')
        .select('lead_id')
        .in('lead_id', leadIds)
        .eq('status', 'PENDING')
        .eq('requested_by', mechanicId);

      (extraWork || []).forEach((row: any) => extraWorkLeadIds.add(row.lead_id));
    }

    const checklistByLead = new Map<string, { done: number; total: number }>();
    if (leadIds.length > 0) {
      const { data: checklistRows } = await supabaseAdmin
        .from('service_checklists')
        .select('lead_id, completed_items, total_items')
        .in('lead_id', leadIds)
        .eq('mechanic_id', mechanicId);

      (checklistRows || []).forEach((row: any) => {
        checklistByLead.set(row.lead_id, {
          done: Number(row.completed_items) || 0,
          total: Number(row.total_items) || 0,
        });
      });
    }

    const jobs = rows
      .map((mj: any) => {
        const lead = mj.lead || {};
        const serviceType = lead.service_type || 'General Service';
        const checklist = checklistByLead.get(mj.lead_id) || { done: 0, total: 0 };
        const rawStatus = mj.mechanic_status || 'ASSIGNED';
        return {
          id: mj.id,
          job_id: mj.id,
          lead_id: mj.lead_id,
          lead_number: lead.lead_number || '',
          customer_name: lead.customer_name || 'Customer',
          vehicle_number: lead.vehicle_number || '',
          vehicle_make: lead.vehicle_make || '',
          vehicle_model: lead.vehicle_model || '',
          service_type: serviceType,
          service_types: serviceType ? [serviceType] : [],
          mechanic_status: rawStatus,
          display_status: resolveMechanicDisplayStatus(
            rawStatus,
            checklist.done,
            checklist.total,
            extraWorkLeadIds.has(mj.lead_id) || !!mj.has_pending_extra_work,
          ),
          checklist_done: checklist.done,
          checklist_total: checklist.total,
          job_priority: mj.job_priority || 'NORMAL',
          assigned_at: mj.assigned_at,
          started_at: mj.started_at,
          completed_at: mj.completed_at,
          sla_remaining_minutes: mj.sla_remaining_minutes || 0,
          before_images_count: mj.before_images_count || 0,
          progress_images_count: mj.progress_images_count || 0,
          after_images_count: mj.after_images_count || 0,
          has_pending_extra_work: extraWorkLeadIds.has(mj.lead_id) || !!mj.has_pending_extra_work,
          checklist_completed: !!mj.checklist_completed,
          pickup_status: lead.pickup_status || 'NOT_REQUIRED',
          pickup_required: !!lead.pickup_required,
          lead_status: lead.status,
        };
      });

    return NextResponse.json({ success: true, jobs, mechanic_id: mechanicId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch mechanic jobs', details: message }, { status: 500 });
  }
}
