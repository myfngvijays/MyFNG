import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveBookingSource } from '@/lib/booking-lead-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type DashboardPeriod =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | '90d'
  | 'this_month'
  | '1y'
  | 'all'
  | 'custom';

type PeriodConfig = {
  period: DashboardPeriod;
  label: string;
  start: string;
  end: string;
  chartMode: 'day' | 'month';
  chartBuckets: number;
  bucketDays: number;
  applyStartFilter: boolean;
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Statuses that mean the lead was accepted into the workshop pipeline (not stuck on NEW). */
const PIPELINE_ACCEPTED = [
  'ACCEPTED',
  'VALIDATED',
  'IN_PROGRESS',
  'TEAM_ASSIGNED',
  'ASSIGNED_TO_WORKER',
  'PICKUP_SCHEDULED',
  'PICKUP_ASSIGNED',
  'PICKUP_IN_PROGRESS',
  'ON_THE_WAY',
  'VEHICLE_DROPPED',
  'QC_APPROVED',
  'READY_FOR_BILLING',
  'READY_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERED_TO_CUSTOMER',
  'COMPLETED',
  'CLOSED',
  'HOLD',
  'REWORK_REQUIRED',
];

async function assertSuperAdmin(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized', user: null };
  }

  const selectRole = 'id, roles!inner(role_code)';
  let userData: any = null;

  const { data: byId } = await supabase
    .from('users_login')
    .select(selectRole)
    .eq('id', user.id)
    .maybeSingle();
  userData = byId;

  if (!userData && user.email) {
    const { data: byEmail } = await supabase
      .from('users_login')
      .select(selectRole)
      .ilike('email', user.email)
      .maybeSingle();
    userData = byEmail;
  }

  if (!userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed', user };
  }
  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin', user };
  }
  return { ok: true, status: 200, error: null, user };
}

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
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function addDaysYmd(ymd: string, delta: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d) + delta * 24 * 60 * 60 * 1000;
  const dt = new Date(utc);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function istBoundsFromYmd(ymd: string, endOfDay: boolean) {
  const parts = String(ymd || '').slice(0, 10).split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) {
    return endOfDay ? endOfTodayISO() : startOfTodayISO();
  }
  const utcMs = endOfDay
    ? Date.UTC(y, m - 1, d, 23, 59, 59, 999) - IST_OFFSET_MS
    : Date.UTC(y, m - 1, d, 0, 0, 0) - IST_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

function todayYmd() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
}

function daysBetweenIso(startIso: string, endIso: string) {
  const ms = Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime());
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function chartConfigForSpan(days: number): Pick<PeriodConfig, 'chartMode' | 'chartBuckets' | 'bucketDays'> {
  if (days <= 1) return { chartMode: 'day', chartBuckets: 1, bucketDays: 1 };
  if (days <= 31) return { chartMode: 'day', chartBuckets: days, bucketDays: 1 };
  if (days <= 90) return { chartMode: 'day', chartBuckets: Math.ceil(days / 3), bucketDays: 3 };
  return { chartMode: 'month', chartBuckets: Math.min(12, Math.ceil(days / 30)), bucketDays: 30 };
}

function resolvePeriod(
  raw: string | null,
  customStart?: string | null,
  customEnd?: string | null
): PeriodConfig {
  const todayStart = startOfTodayISO();
  const todayEnd = endOfTodayISO();
  const value = String(raw || 'today').toLowerCase();

  if (value === 'all' || value === 'all_time') {
    return {
      period: 'all',
      label: 'All Time',
      start: '1970-01-01T00:00:00.000Z',
      end: todayEnd,
      chartMode: 'month',
      chartBuckets: 12,
      bucketDays: 30,
      applyStartFilter: false,
    };
  }

  if (value === 'custom') {
    let startYmd = String(customStart || todayYmd()).slice(0, 10);
    let endYmd = String(customEnd || todayYmd()).slice(0, 10);
    if (startYmd > endYmd) {
      const tmp = startYmd;
      startYmd = endYmd;
      endYmd = tmp;
    }
    const start = istBoundsFromYmd(startYmd, false);
    const end = istBoundsFromYmd(endYmd, true);
    return {
      period: 'custom',
      label: `${startYmd} → ${endYmd}`,
      start,
      end,
      ...chartConfigForSpan(daysBetweenIso(start, end)),
      applyStartFilter: true,
    };
  }

  if (value === 'yesterday') {
    const y = addDaysYmd(todayYmd(), -1);
    return {
      period: 'yesterday',
      label: 'Yesterday',
      start: istBoundsFromYmd(y, false),
      end: istBoundsFromYmd(y, true),
      chartMode: 'day',
      chartBuckets: 1,
      bucketDays: 1,
      applyStartFilter: true,
    };
  }

  if (value === 'this_month') {
    return {
      period: 'this_month',
      label: 'This Month',
      start: startOfMonthISO(),
      end: todayEnd,
      ...chartConfigForSpan(daysBetweenIso(startOfMonthISO(), todayEnd)),
      applyStartFilter: true,
    };
  }

  switch (value as DashboardPeriod) {
    case '7d':
      return {
        period: '7d',
        label: 'Last 7 Days',
        start: startOfNDaysAgoISO(7),
        end: todayEnd,
        chartMode: 'day',
        chartBuckets: 7,
        bucketDays: 1,
        applyStartFilter: true,
      };
    case '30d':
      return {
        period: '30d',
        label: 'Last 30 Days',
        start: startOfNDaysAgoISO(30),
        end: todayEnd,
        chartMode: 'day',
        chartBuckets: 30,
        bucketDays: 1,
        applyStartFilter: true,
      };
    case '90d':
      return {
        period: '90d',
        label: 'Last 90 Days',
        start: startOfNDaysAgoISO(90),
        end: todayEnd,
        chartMode: 'day',
        chartBuckets: 30,
        bucketDays: 3,
        applyStartFilter: true,
      };
    case '1y':
      return {
        period: '1y',
        label: 'Last Year',
        start: startOfNDaysAgoISO(365),
        end: todayEnd,
        chartMode: 'month',
        chartBuckets: 12,
        bucketDays: 30,
        applyStartFilter: true,
      };
    case 'today':
    default:
      return {
        period: 'today',
        label: 'Today',
        start: todayStart,
        end: todayEnd,
        chartMode: 'day',
        chartBuckets: 1,
        bucketDays: 1,
        applyStartFilter: true,
      };
  }
}

function safeNum(value: any) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function applyPeriodFilter(query: any, column: string, cfg: PeriodConfig) {
  let q = query.lte(column, cfg.end);
  if (cfg.applyStartFilter) q = q.gte(column, cfg.start);
  return q;
}

function isPipelineAccepted(status: string, acceptedAt?: string | null) {
  const s = String(status || '').toUpperCase();
  if (acceptedAt) return true;
  return PIPELINE_ACCEPTED.includes(s);
}

function isRejected(status: string) {
  return String(status || '').toUpperCase() === 'REJECTED';
}

function humanizeStatus(name: string) {
  return String(name || 'UNKNOWN')
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function buildChartBuckets(cfg: PeriodConfig) {
  const buckets: { label: string; startMs: number; endMs: number }[] = [];
  if (cfg.chartMode === 'month') {
    for (let i = cfg.chartBuckets - 1; i >= 0; i--) {
      const now = new Date(Date.now() + IST_OFFSET_MS);
      const monthIndex = now.getUTCMonth() - i;
      const year = now.getUTCFullYear() + Math.floor(monthIndex / 12);
      const month = ((monthIndex % 12) + 12) % 12;
      const startUtc = Date.UTC(year, month, 1, 0, 0, 0) - IST_OFFSET_MS;
      const endUtc = Date.UTC(year, month + 1, 1, 0, 0, 0) - IST_OFFSET_MS;
      const label = new Date(startUtc + IST_OFFSET_MS).toLocaleString('en-IN', {
        month: 'short',
        timeZone: 'UTC',
      });
      buckets.push({ label, startMs: startUtc, endMs: endUtc });
    }
    return buckets;
  }

  for (let i = cfg.chartBuckets - 1; i >= 0; i--) {
    const startOffset = i * cfg.bucketDays;
    const start = new Date(Date.now() - startOffset * 24 * 60 * 60 * 1000 + IST_OFFSET_MS);
    const startMs =
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0) - IST_OFFSET_MS;
    const endMs = startMs + cfg.bucketDays * 24 * 60 * 60 * 1000;
    const labelDate = new Date(startMs + IST_OFFSET_MS);
    buckets.push({
      label: `${labelDate.getUTCDate()}/${labelDate.getUTCMonth() + 1}`,
      startMs,
      endMs,
    });
  }
  return buckets;
}

async function safeCount(promise: PromiseLike<any> | any): Promise<{ count: number | null; data?: any; error?: any }> {
  try {
    const res = await promise;
    if (res?.error) return { count: 0, data: res.data || [], error: res.error };
    return res || { count: 0, data: [] };
  } catch (error) {
    return { count: 0, data: [], error };
  }
}

/** Paginate to reduce undercount on long ranges (Supabase row cap). */
async function fetchLeadsForCharts(db: any, cfg: PeriodConfig, chartStartIso: string) {
  const pageSize = 1000;
  const maxPages = cfg.period === 'all' ? 15 : 25;
  const rows: any[] = [];

  for (let page = 0; page < maxPages; page++) {
    let q = db
      .from('service_leads')
      .select(
        'id, created_at, status, lead_type, lead_source, created_from, accepted_at, workshop_id, customer_name, customer_phone'
      )
      .lte('created_at', cfg.end)
      .gte('created_at', chartStartIso)
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    const { data, error } = await q;
    if (error) break;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return rows;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const search = request.nextUrl.searchParams;
    const periodCfg = resolvePeriod(search.get('period'), search.get('start'), search.get('end'));
    const todayStart = startOfTodayISO();
    const todayEnd = endOfTodayISO();
    const monthStart = startOfMonthISO();
    const periodStart = periodCfg.start;
    const periodEnd = periodCfg.end;

    // Chart sample window: for All Time use last 12 months (matches monthly buckets)
    const chartBuckets = buildChartBuckets(periodCfg);
    const chartStartIso =
      periodCfg.period === 'all'
        ? new Date(chartBuckets[0]?.startMs || Date.now() - 365 * 86400000).toISOString()
        : periodStart;

    // --------------------
    // Global metrics (count queries — accurate even for All Time)
    // --------------------
    const [
      leadsInPeriod,
      acceptedInPeriod,
      rejectedInPeriod,
      slaBreaches,
      verifiedWorkshops,
      totalCustomers,
      newCustomers,
      openComplaints,
      activeRsaService,
      pendingFollowUps,
      fraudOpen,
    ] = await Promise.all([
      safeCount(
        applyPeriodFilter(db.from('service_leads').select('id', { count: 'exact', head: true }), 'created_at', periodCfg)
      ),
      safeCount(
        applyPeriodFilter(
          db
            .from('service_leads')
            .select('id', { count: 'exact', head: true })
            .not('status', 'in', '(NEW,ASSIGNED,REJECTED,CANCELLED)'),
          'created_at',
          periodCfg
        )
      ),
      safeCount(
        applyPeriodFilter(
          db.from('service_leads').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED'),
          'created_at',
          periodCfg
        )
      ),
      safeCount(
        db
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('sla_status', 'BREACHED')
          .not('status', 'in', '(COMPLETED,CANCELLED,CLOSED,DELIVERED,DELIVERED_TO_CUSTOMER,REJECTED)')
      ),
      safeCount(db.from('workshops').select('id', { count: 'exact', head: true }).eq('is_verified', true)),
      safeCount(db.from('customers').select('id', { count: 'exact', head: true })),
      safeCount(
        applyPeriodFilter(db.from('customers').select('id', { count: 'exact', head: true }), 'created_at', periodCfg)
      ),
      safeCount(
        db
          .from('customer_complaints')
          .select('id', { count: 'exact', head: true })
          .in('status', ['OPEN', 'IN_PROGRESS', 'ESCALATED'])
      ),
      safeCount(
        db
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('lead_type', 'RSA')
          .not('status', 'in', '(COMPLETED,CANCELLED,CLOSED,DELIVERED,DELIVERED_TO_CUSTOMER)')
      ),
      safeCount(
        db
          .from('telecaller_follow_ups')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'PENDING')
          .lte('scheduled_time', todayEnd)
      ),
      safeCount(
        db
          .from('fraud_cases')
          .select('id', { count: 'exact', head: true })
          .in('status', ['REPORTED', 'INVESTIGATING', 'ESCALATED', 'UNDER_INVESTIGATION', 'PENDING'])
      ),
    ]);

    const [paidInPeriod, paidThisMonth] = await Promise.all([
      applyPeriodFilter(
        db
          .from('invoices')
          .select('paid_amount, final_amount, paid_at')
          .eq('payment_status', 'PAID')
          .limit(10000),
        'paid_at',
        periodCfg
      ),
      db
        .from('invoices')
        .select('paid_amount, final_amount, paid_at')
        .eq('payment_status', 'PAID')
        .gte('paid_at', monthStart)
        .limit(10000),
    ]);

    const periodRevenue = (paidInPeriod.data || []).reduce(
      (sum: number, inv: any) => sum + safeNum(inv?.paid_amount ?? inv?.final_amount ?? 0),
      0
    );
    const monthlyRevenue = (paidThisMonth.data || []).reduce(
      (sum: number, inv: any) => sum + safeNum(inv?.paid_amount ?? inv?.final_amount ?? 0),
      0
    );

    const ratingQuery = applyPeriodFilter(
      db
        .from('service_leads')
        .select('customer_satisfaction_score')
        .not('customer_satisfaction_score', 'is', null)
        .limit(5000),
      'completed_at',
      periodCfg
    );
    const { data: ratingRows } = await ratingQuery;
    const ratingValues = (ratingRows || [])
      .map((r: any) => safeNum(r?.customer_satisfaction_score))
      .filter((n: number) => n > 0);
    const avgRating = Math.round(avg(ratingValues) * 10) / 10;

    const totalLeads = leadsInPeriod.count || 0;
    const acceptedLeads = acceptedInPeriod.count || 0;
    const rejectedLeads = rejectedInPeriod.count || 0;
    const conversionRate = totalLeads > 0 ? Math.round((acceptedLeads / totalLeads) * 100) : 0;

    // --------------------
    // Department metrics
    // --------------------
    const [teleLeads, teleFollowUps, teleRecent] = await Promise.all([
      applyPeriodFilter(
        db.from('service_leads').select('id', { count: 'exact', head: true }).not('assigned_telecaller_id', 'is', null),
        'created_at',
        periodCfg
      ),
      db
        .from('telecaller_follow_ups')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING')
        .gte('scheduled_time', periodCfg.period === 'today' ? todayStart : periodStart)
        .lte('scheduled_time', periodCfg.period === 'today' ? todayEnd : periodEnd),
      applyPeriodFilter(
        db.from('service_leads').select('status').not('assigned_telecaller_id', 'is', null).limit(5000),
        'created_at',
        periodCfg
      ),
    ]);

    const teleTotal = teleRecent.data?.length || 0;
    const teleConverted = (teleRecent.data || []).filter((l: any) =>
      isPipelineAccepted(l?.status)
    ).length;
    const teleConversion = teleTotal > 0 ? Math.round((teleConverted / teleTotal) * 100) : 0;

    const { data: assignedRows } = await applyPeriodFilter(
      db
        .from('service_leads')
        .select('created_at, lead_manager_assigned_at, assigned_to_workshop_at, status')
        .not('workshop_id', 'is', null)
        .limit(5000),
      'lead_manager_assigned_at',
      periodCfg
    );

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
    const rejectedAssigned = (assignedRows || []).filter((r: any) => isRejected(r?.status)).length;
    const leadManagerAccuracy =
      assignedCount > 0
        ? Math.max(0, Math.min(100, Math.round(((assignedCount - rejectedAssigned) / assignedCount) * 100)))
        : 0;

    const [busyWorkshops, completedRows] = await Promise.all([
      db
        .from('service_leads')
        .select('workshop_id')
        .not('status', 'in', '(COMPLETED,DELIVERED,DELIVERED_TO_CUSTOMER,CLOSED,CANCELLED,REJECTED)')
        .not('workshop_id', 'is', null)
        .limit(5000),
      applyPeriodFilter(
        db
          .from('service_leads')
          .select('accepted_at, assigned_to_workshop_at, completed_at, updated_at, created_at, status, workshop_id')
          .in('status', ['COMPLETED', 'DELIVERED', 'DELIVERED_TO_CUSTOMER', 'CLOSED'])
          .not('workshop_id', 'is', null)
          .limit(5000),
        'completed_at',
        periodCfg
      ),
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

    const [rsaActive, rsaRecent] = await Promise.all([
      db
        .from('rsa_leads')
        .select('id', { count: 'exact', head: true })
        .eq('delete_status', false)
        .not('lead_status', 'in', '(completed,cancelled,closed)'),
      applyPeriodFilter(
        db
          .from('rsa_leads')
          .select('lead_status, lead_registered_at, assigned_to_manager_at')
          .eq('delete_status', false)
          .limit(5000),
        'lead_registered_at',
        periodCfg
      ),
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

    const [auditsInPeriod, completedAudits] = await Promise.all([
      applyPeriodFilter(db.from('workshop_audits').select('id', { count: 'exact', head: true }), 'created_at', periodCfg),
      applyPeriodFilter(
        db
          .from('workshop_audits')
          .select('score_percentage')
          .eq('audit_status', 'COMPLETED')
          .not('score_percentage', 'is', null)
          .limit(5000),
        'created_at',
        periodCfg
      ),
    ]);

    const auditScores10 = (completedAudits.data || [])
      .map((r: any) => safeNum(r?.score_percentage) / 10)
      .filter((n: number) => n > 0);
    const avgAuditScore10 = Math.round(avg(auditScores10) * 10) / 10;

    // --------------------
    // App & Membership
    // --------------------
    const [
      activeMemberships,
      newMemberships,
      membershipRevRows,
      healthReports,
      resaleReports,
      walletCredits,
      pushDevices,
    ] = await Promise.all([
      safeCount(db.from('customer_memberships').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE')),
      safeCount(
        applyPeriodFilter(
          db.from('customer_memberships').select('id', { count: 'exact', head: true }),
          'created_at',
          periodCfg
        )
      ),
      safeCount(
        applyPeriodFilter(
          db.from('customer_memberships').select('amount_paid').limit(10000),
          'created_at',
          periodCfg
        )
      ),
      safeCount(
        applyPeriodFilter(
          db.from('vehicle_health_reports').select('id', { count: 'exact', head: true }),
          'created_at',
          periodCfg
        )
      ),
      safeCount(
        applyPeriodFilter(
          db.from('car_resale_valuations').select('id', { count: 'exact', head: true }),
          'created_at',
          periodCfg
        )
      ),
      safeCount(
        applyPeriodFilter(
          db.from('wallet_transactions').select('amount').eq('type', 'CREDIT').limit(10000),
          'created_at',
          periodCfg
        )
      ),
      safeCount(db.from('notification_devices').select('id', { count: 'exact', head: true })),
    ]);

    const membershipRevenue = (membershipRevRows.data || []).reduce(
      (sum: number, r: any) => sum + safeNum(r?.amount_paid),
      0
    );
    const totalWalletCredits = (walletCredits.data || []).reduce(
      (sum: number, r: any) => sum + safeNum(r?.amount),
      0
    );

    // --------------------
    // Charts + tables (paginated sample)
    // --------------------
    const leadsSample = await fetchLeadsForCharts(db, periodCfg, chartStartIso);

    const dailyLeadsTrend = chartBuckets.map((bucket) => {
      const dayLeads = leadsSample.filter((l: any) => {
        const t = new Date(l.created_at).getTime();
        return t >= bucket.startMs && t < bucket.endMs;
      });
      return {
        date: bucket.label,
        total: dayLeads.length,
        accepted: dayLeads.filter((l: any) => isPipelineAccepted(l.status, l.accepted_at)).length,
        rejected: dayLeads.filter((l: any) => isRejected(l.status)).length,
      };
    });

    const serviceTypeMap = new Map<string, number>();
    const leadSourceMap = new Map<string, number>();
    const statusMap = new Map<string, number>();
    const workshopLeadMap = new Map<string, number>();

    for (const r of leadsSample) {
      const type = String(r?.lead_type || 'OTHER').toUpperCase();
      serviceTypeMap.set(type, (serviceTypeMap.get(type) || 0) + 1);
      const sourceLabel = resolveBookingSource(r as Record<string, any>).booking_source_label || 'Other';
      leadSourceMap.set(sourceLabel, (leadSourceMap.get(sourceLabel) || 0) + 1);
      const status = String(r?.status || 'UNKNOWN');
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
      if (r?.workshop_id) {
        workshopLeadMap.set(r.workshop_id, (workshopLeadMap.get(r.workshop_id) || 0) + 1);
      }
    }

    const serviceTypeBreakdown = [...serviceTypeMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const leadSourceBreakdown = [...leadSourceMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    const statusSorted = [...statusMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value);
    const statusTotal = statusSorted.reduce((s, r) => s + r.value, 0) || 1;
    const leadStatusTop = statusSorted.filter((row) => row.value / statusTotal >= 0.02).slice(0, 6);
    const leadStatusRest = statusSorted.filter((row) => !leadStatusTop.includes(row));
    const leadStatusOther = leadStatusRest.reduce((s, r) => s + r.value, 0);
    const leadStatusDistribution = [
      ...leadStatusTop.map((row) => ({ name: humanizeStatus(row.name), value: row.value })),
      ...(leadStatusOther > 0 ? [{ name: 'Other', value: leadStatusOther }] : []),
    ];

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

    const revenueQuery = applyPeriodFilter(
      db.from('invoices').select('paid_amount, final_amount, paid_at').eq('payment_status', 'PAID'),
      'paid_at',
      periodCfg.period === 'all'
        ? { ...periodCfg, applyStartFilter: true, start: chartStartIso }
        : periodCfg
    );
    const { data: revenueInPeriod } = await revenueQuery;

    const dailyRevenueTrend = chartBuckets.map((bucket) => {
      const dayRevenue = (revenueInPeriod || [])
        .filter((inv: any) => {
          const t = new Date(inv.paid_at).getTime();
          return t >= bucket.startMs && t < bucket.endMs;
        })
        .reduce((sum: number, inv: any) => sum + safeNum(inv?.paid_amount ?? inv?.final_amount ?? 0), 0);
      return { date: bucket.label, revenue: Math.round(dayRevenue) };
    });

    // Top workshops
    const topWorkshopIds = [...workshopLeadMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    let topWorkshops: { id: string; name: string; leads: number }[] = [];
    if (topWorkshopIds.length) {
      const ids = topWorkshopIds.map(([id]) => id);
      const { data: workshopRows } = await db
        .from('workshops')
        .select('id, name, workshop_name')
        .in('id', ids);
      const nameById = new Map(
        (workshopRows || []).map((w: any) => [w.id, w.workshop_name || w.name || 'Workshop'])
      );
      topWorkshops = topWorkshopIds.map(([id, leads]) => ({
        id,
        name: String(nameById.get(id) || 'Workshop'),
        leads,
      }));
    }

    const recentLeads = leadsSample.slice(0, 12).map((l: any) => {
      const source = resolveBookingSource(l as Record<string, any>).booking_source_label || 'Other';
      return {
        id: l.id,
        customer_name: l.customer_name || '—',
        customer_phone: l.customer_phone || '—',
        status: humanizeStatus(l.status || 'UNKNOWN'),
        lead_type: String(l.lead_type || 'OTHER').toUpperCase(),
        source,
        created_at: l.created_at,
      };
    });

    // Alerts
    const alerts: {
      id: string;
      type: string;
      title: string;
      message: string;
      href?: string;
    }[] = [];

    if ((slaBreaches.count || 0) > 0) {
      alerts.push({
        id: 'sla',
        type: 'CRITICAL',
        title: 'SLA Breaches',
        message: `${slaBreaches.count} open leads have breached SLA`,
        href: '/dashboard/super_admin/bookings',
      });
    }
    if ((fraudOpen.count || 0) > 0) {
      alerts.push({
        id: 'fraud',
        type: 'CRITICAL',
        title: 'Open Fraud Cases',
        message: `${fraudOpen.count} fraud cases need investigation`,
        href: '/dashboard/super_admin/fraud',
      });
    }
    if ((openComplaints.count || 0) > 0) {
      alerts.push({
        id: 'complaints',
        type: 'WARNING',
        title: 'Open Complaints',
        message: `${openComplaints.count} customer complaints are open`,
        href: '/dashboard/super_admin/bookings',
      });
    }
    if ((pendingFollowUps.count || 0) > 0) {
      alerts.push({
        id: 'followups',
        type: 'WARNING',
        title: 'Pending Follow-ups',
        message: `${pendingFollowUps.count} telecaller follow-ups are due/overdue`,
        href: '/dashboard/super_admin/telecaller-distribution',
      });
    }
    if (busyDistinct.size > 20) {
      alerts.push({
        id: 'busy',
        type: 'INFO',
        title: 'Busy Workshops',
        message: `${busyDistinct.size} workshops currently have active jobs`,
        href: '/dashboard/super_admin/workshops',
      });
    }

    return NextResponse.json({
      period: periodCfg.period,
      periodLabel: periodCfg.label,
      chartSampleNote:
        periodCfg.period === 'all'
          ? 'Charts sample the last 12 months; metric cards use full All Time counts.'
          : leadsSample.length >= 1000 * 20
            ? 'Charts use a large sample; totals on metric cards are exact.'
            : null,
      globalMetrics: {
        totalLeadsToday: totalLeads,
        acceptedLeads,
        rejectedLeads,
        conversionRate,
        slaBreaches: slaBreaches.count || 0,
        dailyRevenue: periodRevenue,
        monthlyRevenue,
        activeWorkshops: verifiedWorkshops.count || 0,
        totalCustomers: totalCustomers.count || 0,
        newCustomers: newCustomers.count || 0,
        avgRating,
        complaintVolume: openComplaints.count || 0,
        rsaActive: activeRsaService.count || 0,
      },
      departmentMetrics: {
        telecaller: {
          leads7d: teleLeads.count || 0,
          followUpsToday: teleFollowUps.count || 0,
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
          auditsToday: auditsInPeriod.count || 0,
          fraudOpen: fraudOpen.count || 0,
          avgScore10: avgAuditScore10,
        },
      },
      appMetrics: {
        activeMemberships: activeMemberships.count || 0,
        newMemberships7d: newMemberships.count || 0,
        membershipRevenueMonth: membershipRevenue,
        healthReports30d: healthReports.count || 0,
        resaleReports30d: resaleReports.count || 0,
        totalWalletCredits30d: totalWalletCredits,
        pushDevices: pushDevices.count || 0,
      },
      charts: {
        dailyLeadsTrend,
        dailyRevenueTrend,
        serviceTypeBreakdown,
        leadSourceBreakdown,
        membershipPlanDistribution,
        leadStatusDistribution,
      },
      topWorkshops,
      recentLeads,
      alerts,
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
