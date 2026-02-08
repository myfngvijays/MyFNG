import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized', user: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed', user };
  }
  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin', user };
  }
  return { ok: true, status: 200, error: null, user };
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function startOfTodayISO() {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const utcMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 0, 0, 0);
  return new Date(utcMs - IST_OFFSET_MS).toISOString();
}

function endOfTodayISO() {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const utcMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 23, 59, 59, 999);
  return new Date(utcMs - IST_OFFSET_MS).toISOString();
}

function startOfMonthISO() {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const utcMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1, 0, 0, 0);
  return new Date(utcMs - IST_OFFSET_MS).toISOString();
}

function startOfNDaysAgoISO(days: number) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

function safeNum(value: any) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const todayStart = startOfTodayISO();
    const todayEnd = endOfTodayISO();
    const monthStart = startOfMonthISO();
    const sevenDaysAgo = startOfNDaysAgoISO(7);
    const thirtyDaysAgo = startOfNDaysAgoISO(30);

    // --------------------
    // Global metrics
    // --------------------
    const [
      leadsToday,
      acceptedToday,
      rejectedToday,
      slaBreaches,
      verifiedWorkshops,
      totalCustomers,
      openComplaints,
      activeRsaLeads, // Service RSA (not roadside RSA-leads)
    ] = await Promise.all([
      db.from('service_leads').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
      db
        .from('service_leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart)
        .eq('status', 'ACCEPTED'),
      db
        .from('service_leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart)
        .eq('status', 'REJECTED'),
      db
        .from('service_leads')
        .select('id', { count: 'exact', head: true })
        .eq('sla_status', 'BREACHED')
        .not('status', 'in', '(COMPLETED,CANCELLED,CLOSED,DELIVERED)'),
      db.from('workshops').select('id', { count: 'exact', head: true }).eq('is_verified', true),
      db.from('customers').select('id', { count: 'exact', head: true }),
      db
        .from('customer_complaints')
        .select('id', { count: 'exact', head: true })
        .in('status', ['OPEN', 'IN_PROGRESS', 'ESCALATED']),
      db
        .from('service_leads')
        .select('id', { count: 'exact', head: true })
        .eq('lead_type', 'RSA')
        .not('status', 'in', '(COMPLETED,CANCELLED,CLOSED,DELIVERED)'),
    ]);

    // Revenue: today + this month (paid invoices)
    const [paidToday, paidThisMonth] = await Promise.all([
      db
        .from('invoices')
        .select('paid_amount, final_amount, paid_at')
        .eq('payment_status', 'PAID')
        .gte('paid_at', todayStart),
      db
        .from('invoices')
        .select('paid_amount, final_amount, paid_at')
        .eq('payment_status', 'PAID')
        .gte('paid_at', monthStart),
    ]);

    const dailyRevenue = (paidToday.data || []).reduce(
      (sum: number, inv: any) => sum + safeNum(inv?.paid_amount ?? inv?.final_amount ?? 0),
      0
    );
    const monthlyRevenue = (paidThisMonth.data || []).reduce(
      (sum: number, inv: any) => sum + safeNum(inv?.paid_amount ?? inv?.final_amount ?? 0),
      0
    );

    // Avg rating: use customer_satisfaction_score from completed leads last 30 days
    const { data: ratingRows } = await db
      .from('service_leads')
      .select('customer_satisfaction_score')
      .gte('completed_at', thirtyDaysAgo)
      .not('customer_satisfaction_score', 'is', null)
      .limit(5000);

    const ratingValues = (ratingRows || [])
      .map((r: any) => safeNum(r?.customer_satisfaction_score))
      .filter((n: number) => n > 0);

    const avgRating = Math.round(avg(ratingValues) * 10) / 10;

    // --------------------
    // Department metrics (computed, no hardcoding)
    // --------------------

    // Telecaller
    const [teleLeads7d, teleFollowUpsToday, teleRecentLeads7d] = await Promise.all([
      db
        .from('service_leads')
        .select('id', { count: 'exact', head: true })
        .not('assigned_telecaller_id', 'is', null)
        .gte('created_at', sevenDaysAgo),
      db
        .from('telecaller_follow_ups')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING')
        .gte('scheduled_time', todayStart)
        .lte('scheduled_time', todayEnd),
      db
        .from('service_leads')
        .select('status')
        .not('assigned_telecaller_id', 'is', null)
        .gte('created_at', sevenDaysAgo)
        .limit(5000),
    ]);

    const teleTotal = teleRecentLeads7d.data?.length || 0;
    const teleConverted = (teleRecentLeads7d.data || []).filter((l: any) =>
      ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED', 'CLOSED'].includes(String(l?.status || '').toUpperCase())
    ).length;
    const teleConversion = teleTotal > 0 ? Math.round((teleConverted / teleTotal) * 100) : 0;

    // Lead Manager
    const { data: assignedRows } = await db
      .from('service_leads')
      .select('created_at, lead_manager_assigned_at, assigned_to_workshop_at, status')
      .not('workshop_id', 'is', null)
      .gte('lead_manager_assigned_at', sevenDaysAgo)
      .limit(5000);

    const assignMins = (assignedRows || [])
      .map((r: any) => {
        const c = r?.created_at ? new Date(r.created_at).getTime() : NaN;
        const assignedAtRaw = r?.lead_manager_assigned_at || r?.assigned_to_workshop_at || null;
        const a = assignedAtRaw ? new Date(assignedAtRaw).getTime() : NaN;
        if (!Number.isFinite(c) || !Number.isFinite(a)) return null;
        return Math.max(0, Math.round((a - c) / 60000));
      })
      .filter((n: any) => typeof n === 'number') as number[];

    const assignedCount = (assignedRows || []).length;
    const rejectedCount = (assignedRows || []).filter((r: any) => String(r?.status || '').toUpperCase() === 'REJECTED')
      .length;
    const leadManagerAccuracy =
      assignedCount > 0 ? Math.max(0, Math.min(100, Math.round(((assignedCount - rejectedCount) / assignedCount) * 100))) : 0;

    // Workshops
    const [busyWorkshops, completedRows] = await Promise.all([
      db
        .from('service_leads')
        .select('workshop_id')
        .not(
          'status',
          'in',
          '(COMPLETED,DELIVERED,DELIVERED_TO_CUSTOMER,CLOSED,CANCELLED,REJECTED)'
        )
        .not('workshop_id', 'is', null)
        .gte('created_at', thirtyDaysAgo)
        .limit(5000),
      db
        .from('service_leads')
        .select('accepted_at, assigned_to_workshop_at, completed_at, updated_at, created_at, status')
        .in('status', ['COMPLETED', 'DELIVERED', 'DELIVERED_TO_CUSTOMER', 'CLOSED'])
        .gte('completed_at', sevenDaysAgo)
        .not('workshop_id', 'is', null)
        .limit(5000),
    ]);

    const busyDistinct = new Set((busyWorkshops.data || []).map((r: any) => r?.workshop_id).filter(Boolean));

    const completionHours = (completedRows.data || [])
      .map((r: any) => {
        const start = r?.accepted_at || r?.assigned_to_workshop_at || r?.created_at;
        const end = r?.completed_at || r?.updated_at;
        const s = start ? new Date(start).getTime() : NaN;
        const e = end ? new Date(end).getTime() : NaN;
        if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
        return Math.max(0, (e - s) / (1000 * 60 * 60));
      })
      .filter((n: any) => typeof n === 'number') as number[];

    const avgCompletionHours = Math.round(avg(completionHours) * 10) / 10;

    // RSA
    // RSA (Roadside) from rsa_leads
    const [rsaActive, rsaRecent] = await Promise.all([
      db
        .from('rsa_leads')
        .select('id', { count: 'exact', head: true })
        .eq('delete_status', false)
        .not('lead_status', 'in', '(completed,cancelled,closed)'),
      db
        .from('rsa_leads')
        .select('lead_status, lead_registered_at, assigned_to_manager_at')
        .eq('delete_status', false)
        .gte('lead_registered_at', sevenDaysAgo)
        .limit(5000),
    ]);

    const rsaDispatchMins = (rsaRecent.data || [])
      .map((r: any) => {
        const c = r?.lead_registered_at ? new Date(r.lead_registered_at).getTime() : NaN;
        const a = r?.assigned_to_manager_at ? new Date(r.assigned_to_manager_at).getTime() : NaN;
        if (!Number.isFinite(c) || !Number.isFinite(a)) return null;
        return Math.max(0, Math.round((a - c) / 60000));
      })
      .filter((n: any) => typeof n === 'number') as number[];

    const rsaTotal = (rsaRecent.data || []).length;
    const rsaCompleted = (rsaRecent.data || []).filter((r: any) =>
      ['completed', 'closed'].includes(String(r?.lead_status || '').toLowerCase())
    ).length;
    const rsaCompletionPct = rsaTotal > 0 ? Math.round((rsaCompleted / rsaTotal) * 100) : 0;

    // Auditors
    const [auditsToday, fraudOpen, completedAudits30d] = await Promise.all([
      db
        .from('workshop_audits')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart),
      db
        .from('fraud_cases')
        .select('id', { count: 'exact', head: true })
        .in('status', ['REPORTED', 'UNDER_INVESTIGATION', 'PENDING']),
      db
        .from('workshop_audits')
        .select('score_percentage')
        .eq('audit_status', 'COMPLETED')
        .gte('created_at', thirtyDaysAgo)
        .not('score_percentage', 'is', null)
        .limit(5000),
    ]);

    const auditScores10 = (completedAudits30d.data || [])
      .map((r: any) => safeNum(r?.score_percentage) / 10)
      .filter((n: number) => n > 0);
    const avgAuditScore10 = Math.round(avg(auditScores10) * 10) / 10;

    return NextResponse.json({
      globalMetrics: {
        totalLeadsToday: leadsToday.count || 0,
        acceptedLeads: acceptedToday.count || 0,
        rejectedLeads: rejectedToday.count || 0,
        slaBreaches: slaBreaches.count || 0,
        dailyRevenue,
        monthlyRevenue,
        activeWorkshops: verifiedWorkshops.count || 0,
        totalCustomers: totalCustomers.count || 0,
        avgRating,
        complaintVolume: openComplaints.count || 0,
        rsaActive: activeRsaLeads.count || 0,
      },
      departmentMetrics: {
        telecaller: {
          leads7d: teleLeads7d.count || 0,
          followUpsToday: teleFollowUpsToday.count || 0,
          conversion7d: teleConversion,
        },
        leadManager: {
          assigned7d: assignedCount,
          avgAssignMins7d: Math.round(avg(assignMins)),
          accuracy7d: leadManagerAccuracy,
        },
        workshops: {
          active: verifiedWorkshops.count || 0,
          busy: busyDistinct.size,
          avgCompletionHours7d: avgCompletionHours,
        },
        rsa: {
          active: rsaActive.count || 0,
          avgDispatchMins7d: Math.round(avg(rsaDispatchMins)),
          completion7d: rsaCompletionPct,
        },
        auditors: {
          auditsToday: auditsToday.count || 0,
          fraudOpen: fraudOpen.count || 0,
          avgScore10: avgAuditScore10,
        },
      },
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

