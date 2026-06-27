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

    // --------------------
    // App & Membership metrics
    // --------------------
    const [
      activeMemberships,
      newMemberships7d,
      membershipRevMonth,
      healthReports30d,
      resaleReports30d,
      walletCredits30d,
      pushDevices,
    ] = await Promise.all([
      db.from('customer_memberships').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      db.from('customer_memberships').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      db.from('customer_memberships').select('amount_paid').gte('created_at', monthStart).eq('status', 'ACTIVE'),
      db.from('vehicle_health_reports').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
      db.from('car_resale_valuations').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
      db.from('wallet_transactions').select('amount').eq('type', 'CREDIT').gte('created_at', thirtyDaysAgo),
      db.from('notification_devices').select('id', { count: 'exact', head: true }),
    ]);

    const membershipRevenueMonth = (membershipRevMonth.data || []).reduce(
      (sum: number, r: any) => sum + safeNum(r?.amount_paid),
      0
    );
    const totalWalletCredits30d = (walletCredits30d.data || []).reduce(
      (sum: number, r: any) => sum + safeNum(r?.amount),
      0
    );

    // --------------------
    // Chart data
    // --------------------

    // Daily leads trend (last 7 days)
    const { data: leadsLast7d } = await db
      .from('service_leads')
      .select('created_at, status')
      .gte('created_at', sevenDaysAgo)
      .limit(10000);

    const dailyLeadsTrend: { date: string; total: number; accepted: number; rejected: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000 + IST_OFFSET_MS);
      const dateStr = `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
      const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0) - IST_OFFSET_MS);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const dayLeads = (leadsLast7d || []).filter((l: any) => {
        const t = new Date(l.created_at).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      });
      dailyLeadsTrend.push({
        date: dateStr,
        total: dayLeads.length,
        accepted: dayLeads.filter((l: any) => l.status === 'ACCEPTED').length,
        rejected: dayLeads.filter((l: any) => l.status === 'REJECTED').length,
      });
    }

    // Service type breakdown (pie chart)
    const { data: serviceTypeRows } = await db
      .from('service_leads')
      .select('lead_type')
      .gte('created_at', thirtyDaysAgo)
      .limit(10000);

    const serviceTypeMap = new Map<string, number>();
    for (const r of serviceTypeRows || []) {
      const type = String(r?.lead_type || 'OTHER').toUpperCase();
      serviceTypeMap.set(type, (serviceTypeMap.get(type) || 0) + 1);
    }
    const serviceTypeBreakdown = [...serviceTypeMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Membership plan distribution (pie chart)
    const { data: membershipPlanRows } = await db
      .from('customer_memberships')
      .select('plan_name')
      .eq('status', 'ACTIVE');

    const planMap = new Map<string, number>();
    for (const r of membershipPlanRows || []) {
      const plan = String(r?.plan_name || 'Unknown');
      planMap.set(plan, (planMap.get(plan) || 0) + 1);
    }
    const membershipPlanDistribution = [...planMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Revenue trend (last 7 days)
    const { data: revenueLast7d } = await db
      .from('invoices')
      .select('paid_amount, final_amount, paid_at')
      .eq('payment_status', 'PAID')
      .gte('paid_at', sevenDaysAgo);

    const dailyRevenueTrend: { date: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000 + IST_OFFSET_MS);
      const dateStr = `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
      const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0) - IST_OFFSET_MS);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const dayRevenue = (revenueLast7d || [])
        .filter((inv: any) => {
          const t = new Date(inv.paid_at).getTime();
          return t >= dayStart.getTime() && t < dayEnd.getTime();
        })
        .reduce((sum: number, inv: any) => sum + safeNum(inv?.paid_amount ?? inv?.final_amount ?? 0), 0);
      dailyRevenueTrend.push({ date: dateStr, revenue: Math.round(dayRevenue) });
    }

    // Lead status distribution (pie chart)
    const statusMap = new Map<string, number>();
    for (const r of leadsLast7d || []) {
      const status = String(r?.status || 'UNKNOWN');
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    }
    const leadStatusDistribution = [...statusMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

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
      appMetrics: {
        activeMemberships: activeMemberships.count || 0,
        newMemberships7d: newMemberships7d.count || 0,
        membershipRevenueMonth,
        healthReports30d: healthReports30d.count || 0,
        resaleReports30d: resaleReports30d.count || 0,
        totalWalletCredits30d,
        pushDevices: pushDevices.count || 0,
      },
      charts: {
        dailyLeadsTrend,
        dailyRevenueTrend,
        serviceTypeBreakdown,
        membershipPlanDistribution,
        leadStatusDistribution,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

