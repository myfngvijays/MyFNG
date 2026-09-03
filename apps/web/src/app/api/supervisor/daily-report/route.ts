import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { istDayBounds, istYmd } from '@/lib/telecaller/crmDateRange';
import { FLOOR_DONE_STATUSES, isQcPassed } from '@/lib/workshop/jobFlow';

export const dynamic = 'force-dynamic';

function inRange(iso: string | null | undefined, startMs: number, endMs: number) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= startMs && t <= endMs;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, role_id, roles!inner(role_code)';

    const { data: byEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };
    const { data: byPhone } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };
    const { data: byId } = !byEmail && !byPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null };

    const profile = byEmail || byPhone || byId;
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = String((profile as any)?.roles?.role_code || '');
    if (!['WORKSHOP_SUPERVISOR', 'WORKSHOP_ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const workshopId = profile.workshop_id;
    if (!workshopId && roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No workshop assigned' }, { status: 400 });
    }

    const date = String(request.nextUrl.searchParams.get('date') || istYmd()).slice(0, 10);
    const { start, end } = istDayBounds(date);
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const startIso = new Date(start).toISOString();

    const { supabaseAdmin } = getSupabaseAdmin();
    const reader = supabaseAdmin || supabase;

    let leadQuery = reader
      .from('service_leads')
      .select(
        `id, lead_number, customer_name, vehicle_number, status, qc_status, qc_performed_at,
         mechanic_completed_at, assigned_mechanic_id, assigned_pickup_boy_id, pickup_status,
         pickup_required, created_at, updated_at, workshop_id`,
      )
      .is('deleted_at', null)
      .or(
        `created_at.gte.${startIso},updated_at.gte.${startIso},qc_performed_at.gte.${startIso},mechanic_completed_at.gte.${startIso}`,
      )
      .limit(800);

    if (workshopId) leadQuery = leadQuery.eq('workshop_id', workshopId);

    const [leadsRes, staffRes, extraRes] = await Promise.all([
      leadQuery,
      workshopId
        ? reader
            .from('users_login')
            .select('id, full_name, is_active, role:role_id(role_code)')
            .eq('workshop_id', workshopId)
            .eq('is_active', true)
        : Promise.resolve({ data: [] as any[] }),
      workshopId
        ? reader
            .from('lead_extra_charges')
            .select('id, status, service_leads!inner(workshop_id)', { count: 'exact', head: true })
            .eq('service_leads.workshop_id', workshopId)
            .eq('status', 'PENDING')
        : Promise.resolve({ count: 0 }),
    ]);

    let allLeads = ((leadsRes as any)?.data || []) as any[];
    if ((leadsRes as any)?.error) {
      console.warn('Daily report lead query:', (leadsRes as any).error);
      let fallback = reader
        .from('service_leads')
        .select(
          `id, lead_number, customer_name, vehicle_number, status, qc_status, qc_performed_at,
           mechanic_completed_at, assigned_mechanic_id, assigned_pickup_boy_id, pickup_status,
           pickup_required, created_at, updated_at, workshop_id`,
        )
        .is('deleted_at', null)
        .gte('updated_at', startIso)
        .limit(800);
      if (workshopId) fallback = fallback.eq('workshop_id', workshopId);
      const retry = await fallback;
      if (retry.error) console.warn('Daily report lead fallback:', retry.error);
      allLeads = retry.data || [];
    }
    const todayLeads = allLeads.filter((lead) => {
      return (
        inRange(lead.created_at, startMs, endMs) ||
        inRange(lead.updated_at, startMs, endMs) ||
        inRange(lead.qc_performed_at, startMs, endMs) ||
        inRange(lead.mechanic_completed_at, startMs, endMs)
      );
    });

    const completedLeads = todayLeads.filter((lead) => {
      if (!isQcPassed(lead) && !FLOOR_DONE_STATUSES.has(String(lead.status || '').toUpperCase())) {
        return false;
      }
      return (
        inRange(lead.qc_performed_at, startMs, endMs) ||
        inRange(lead.mechanic_completed_at, startMs, endMs) ||
        inRange(lead.updated_at, startMs, endMs)
      );
    });

    const qcPassedLeads = todayLeads.filter((lead) => {
      const qc = String(lead.qc_status || '').toUpperCase();
      if (qc !== 'PASSED' && qc !== 'APPROVED') return false;
      return inRange(lead.qc_performed_at, startMs, endMs) || inRange(lead.updated_at, startMs, endMs);
    });

    const pendingLeads = todayLeads.filter((lead) => {
      const status = String(lead.status || '').toUpperCase();
      if (['REJECTED', 'CANCELLED', 'CLOSED'].includes(status)) return false;
      if (isQcPassed(lead) || FLOOR_DONE_STATUSES.has(status)) return false;
      return true;
    });

    const overdue = todayLeads.filter((lead) => {
      if (isQcPassed(lead) || FLOOR_DONE_STATUSES.has(String(lead.status || '').toUpperCase())) return false;
      const sla = lead.sla_expires_at || lead.sla_deadline;
      return sla ? new Date(sla).getTime() < Date.now() : false;
    }).length;

    const staff = ((staffRes as any)?.data || []) as any[];
    const roleOf = (row: any) => {
      const role = Array.isArray(row.role) ? row.role[0] : row.role;
      return String(role?.role_code || '');
    };

    const mechanics = staff.filter((row) => roleOf(row) === 'WORKSHOP_MECHANIC').map((m) => {
      const mine = todayLeads.filter((l) => l.assigned_mechanic_id === m.id);
      return {
        id: m.id,
        name: m.full_name,
        assigned: mine.length,
        completed: mine.filter((l) => isQcPassed(l) || FLOOR_DONE_STATUSES.has(String(l.status || '').toUpperCase())).length,
        active: mine.filter((l) => pendingLeads.some((p) => p.id === l.id)).length,
      };
    });

    const pickupBoys = staff.filter((row) => roleOf(row) === 'WORKSHOP_PICKUP_BOY').map((p) => {
      const mine = todayLeads.filter((l) => l.assigned_pickup_boy_id === p.id);
      const completed = mine.filter((l) =>
        ['VEHICLE_DROPPED_AT_WORKSHOP', 'PICKUP_COMPLETED', 'DROPPED'].includes(
          String(l.pickup_status || '').toUpperCase(),
        ),
      ).length;
      const active = mine.filter((l) =>
        ['ASSIGNED', 'ON_THE_WAY', 'OTP_VERIFIED', 'VEHICLE_IN_TRANSIT', 'IN_TRANSIT', 'PICKED'].includes(
          String(l.pickup_status || '').toUpperCase(),
        ),
      ).length;
      return { id: p.id, name: p.full_name, assigned: mine.length, completed, active };
    });

    const leadRows = todayLeads
      .map((lead) => ({
        id: lead.id,
        lead_number: lead.lead_number,
        customer_name: lead.customer_name,
        vehicle_number: lead.vehicle_number,
        status: lead.status,
        qc_status: lead.qc_status,
        qc_passed_today: qcPassedLeads.some((row) => row.id === lead.id),
        completed_today: completedLeads.some((row) => row.id === lead.id),
      }))
      .sort((a, b) => Number(b.qc_passed_today) - Number(a.qc_passed_today));

    return NextResponse.json({
      success: true,
      date,
      report: {
        total: todayLeads.length,
        completed: completedLeads.length,
        pending: pendingLeads.length,
        overdue,
        qcPassed: qcPassedLeads.length,
        extraPending: (extraRes as any)?.count || 0,
      },
      mechanics,
      pickupBoys,
      leads: leadRows,
    });
  } catch (error: any) {
    console.error('Daily report failed:', error);
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
