import { NextRequest, NextResponse } from 'next/server';
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

function normalizeKey(value: string | null | undefined, fallback: string) {
  const raw = String(value || '').trim();
  return raw ? raw : fallback;
}

function normalizePincode(value?: string | null) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function parseLocation(address?: string | null, pincode?: string | null) {
  const raw = String(address || '').trim();
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const state = normalizeKey(parts[parts.length - 1], 'Unknown');
  const district = normalizeKey(parts[parts.length - 2], normalizeKey(pincode, 'Unknown'));
  return { state, district };
}

function toNumber(value: any) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function parseAmount(value: any) {
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (!cleaned) return 0;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function isResolved(lead: any) {
  const leadStatus = String(lead?.lead_status || '').toLowerCase();
  const complaintStatus = String(lead?.complaint_status || '').toLowerCase();
  return ['completed', 'closed'].includes(leadStatus) || ['completed', 'closed'].includes(complaintStatus);
}

function matchesStatusFilter(lead: any, statusFilter: string) {
  const normalized = String(statusFilter || '').trim().toLowerCase();
  if (!normalized || normalized === 'all') return true;
  const leadStatus = String(lead?.lead_status || '').trim().toLowerCase();
  const complaintStatus = String(lead?.complaint_status || '').trim().toLowerCase();
  if (normalized === 'unknown') {
    return (!leadStatus && !complaintStatus) || leadStatus === 'unknown' || complaintStatus === 'unknown';
  }
  if (normalized === 'resolved') return isResolved(lead);
  if (normalized === 'pending') return !isResolved(lead);
  return leadStatus === normalized || complaintStatus === normalized;
}

function collectStatusOptions(leads: any[]) {
  const set = new Set<string>();
  let hasUnknown = false;
  for (const lead of leads || []) {
    const leadStatus = String(lead?.lead_status || '').trim().toLowerCase();
    const complaintStatus = String(lead?.complaint_status || '').trim().toLowerCase();
    if (leadStatus) set.add(leadStatus);
    if (complaintStatus) set.add(complaintStatus);
    if (!leadStatus && !complaintStatus) hasUnknown = true;
  }
  if (hasUnknown) set.add('unknown');
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function addToBreakdown(map: Map<string, any>, key: string, name: string, lead: any) {
  const entry = map.get(key) || {
    key,
    name,
    total: 0,
    resolved: 0,
    revenue: 0, // quoted total
    mechanic_payment: 0,
    company_profit: 0,
    advance_amount: 0,
  };
  entry.total += 1;
  if (isResolved(lead)) entry.resolved += 1;
  const quoted = toNumber(lead.customer_quoted_amount || 0);
  const mechanicPayment = toNumber(lead.payment_to_mechanic || 0);
  const advance = parseAmount(lead.advance_payment);
  entry.revenue += quoted;
  entry.mechanic_payment += mechanicPayment;
  entry.company_profit += quoted - mechanicPayment;
  entry.advance_amount += advance;
  map.set(key, entry);
}

function finalizeBreakdown(map: Map<string, any>, sortBy: 'total' | 'profit' = 'total') {
  const rows = Array.from(map.values()).map((row) => ({
    ...row,
    rate: row.total ? (row.resolved / row.total) * 100 : 0,
  }));

  if (sortBy === 'profit') {
    return rows.sort((a, b) => {
      const diff = (b.company_profit || 0) - (a.company_profit || 0);
      if (diff !== 0) return diff;
      return (b.total || 0) - (a.total || 0);
    });
  }

  return rows.sort((a, b) => (b.total || 0) - (a.total || 0));
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const from = searchParams.get('from') || defaultFrom.toISOString();
    const to = searchParams.get('to') || now.toISOString();
    const statusFilter = String(searchParams.get('status') || '').trim().toLowerCase();

    const dateFilter = `and(lead_registered_at.gte.${from},lead_registered_at.lte.${to}),and(requested_at.gte.${from},requested_at.lte.${to})`;
    const { data: leads, error } = await db
      .from('rsa_leads')
      .select(
        `
        id,
        service_type,
        service_tag,
        lead_status,
        complaint_status,
        lead_registered_at,
        requested_at,
        mechanic_completed_datetime,
        customer_quoted_amount,
        advance_payment,
        payment_received,
        payment_to_mechanic,
        assigned_mechanic_id,
        assigned_mechanic_name,
        assigned_manager_id,
        assigned_manager_name,
        registered_by_id,
        registered_by_name,
        address,
        pincode
      `
      )
      .eq('delete_status', false)
      .or(dateFilter);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch RSA overview data' }, { status: 500 });
    }

    const allRows = Array.isArray(leads) ? leads : [];
    const statusOptions = collectStatusOptions(allRows);
    const rows = allRows.filter((lead: any) => matchesStatusFilter(lead, statusFilter));
    const pincodes = Array.from(
      new Set(
        rows
          .map((row: any) => normalizePincode(row?.pincode))
          .filter((value: string) => value)
      )
    );
    const pincodeMap = new Map<string, { district: string | null; state: string | null }>();
    if (pincodes.length) {
      const { data: pincodeRows } = await db
        .from('pincode_city_state')
        .select('pincode, district, state')
        .in('pincode', pincodes);
      for (const row of pincodeRows || []) {
        const key = normalizePincode(row?.pincode);
        if (!key) continue;
        pincodeMap.set(key, {
          district: row?.district || null,
          state: row?.state || null,
        });
      }
    }
    const totalRequests = rows.length;
    let resolved = 0;
    let totalQuoted = 0;
    let advanceAmount = 0;
    let paymentReceived = 0;
    let paymentToMechanic = 0;
    let resolutionSumHours = 0;
    let resolutionCount = 0;
    // Total mechanics should represent master DB count, not "used in this range".

    const deptMap = new Map<string, any>();
    const districtMap = new Map<string, any>();
    const stateMap = new Map<string, any>();
    const employeeMap = new Map<string, any>();
    const mechanicMap = new Map<string, any>();

    for (const lead of rows) {
      const resolvedLead = isResolved(lead);
      if (resolvedLead) resolved += 1;
      totalQuoted += toNumber(lead.customer_quoted_amount || 0);
      advanceAmount += parseAmount((lead as any).advance_payment);
      paymentReceived += toNumber(lead.payment_received || 0);
      paymentToMechanic += toNumber(lead.payment_to_mechanic || 0);

      const startedRaw = lead.lead_registered_at || lead.requested_at;
      const started = startedRaw ? new Date(startedRaw) : null;
      const ended = lead.mechanic_completed_datetime ? new Date(lead.mechanic_completed_datetime) : null;
      if (resolvedLead && started && ended && !Number.isNaN(started.getTime()) && !Number.isNaN(ended.getTime())) {
        const diffHours = (ended.getTime() - started.getTime()) / 36e5;
        if (Number.isFinite(diffHours) && diffHours >= 0) {
          resolutionSumHours += diffHours;
          resolutionCount += 1;
        }
      }

      const department = normalizeKey(lead.service_type || lead.service_tag, 'Unknown');
      addToBreakdown(deptMap, department, department, lead);

      const normalizedPin = normalizePincode(lead.pincode);
      const pincodeEntry = normalizedPin ? pincodeMap.get(normalizedPin) : null;
      const fallback = parseLocation(lead.address, lead.pincode);
      const district = normalizeKey(pincodeEntry?.district || fallback.district, 'Unknown');
      const state = normalizeKey(pincodeEntry?.state || fallback.state, 'Unknown');
      addToBreakdown(districtMap, district, district, lead);
      addToBreakdown(stateMap, state, state, lead);

      const employeeId = normalizeKey(lead.assigned_manager_id || lead.registered_by_id, 'Unassigned');
      const employeeName = normalizeKey(lead.assigned_manager_name || lead.registered_by_name, 'Unassigned');
      // Show only name in UI (no id suffix)
      addToBreakdown(employeeMap, employeeId, employeeName, lead);

      const mechanicId = normalizeKey((lead as any).assigned_mechanic_id, 'Unassigned');
      const mechanicName = normalizeKey((lead as any).assigned_mechanic_name, 'Unassigned');
      addToBreakdown(mechanicMap, mechanicId, mechanicName, lead);
    }

    const avgResolution = resolutionCount ? resolutionSumHours / resolutionCount : null;

    // Master mechanics count (company database)
    const { count: totalMechanicsCount, error: mechCountError } = await db
      .from('company_mechanic_rsa')
      .select('id', { count: 'exact', head: true });
    if (mechCountError) {
      // Non-fatal: keep it 0 if schema differs
      // eslint-disable-next-line no-console
      console.warn('Failed to count company mechanics:', mechCountError?.message);
    }

    let totalLinkGeneratedCount = 0;
    let totalLinkGeneratedAmount = 0;
    let totalCapturedPaymentCount = 0;
    let totalCapturedPaymentAmount = 0;
    let totalRefundCount = 0;
    let totalRefundAmount = 0;
    let paymentRowsForTable: Array<{
      order_id: string | null;
      payment_id: string | null;
      customer_name: string | null;
      customer_phone: string | null;
      employee_name: string | null;
      employee_role: string | null;
      status: string | null;
      amount: number;
      captured_amount: number;
      refunded_amount: number;
      created_at: string | null;
    }> = [];

    // Payment KPIs for selected range.
    // Uses direct-pay ledger table created for RSA pay links.
    try {
      const { data: paymentRows, error: paymentError } = await db
        .from('Razorpay_Direct_pay_RSA')
        .select('order_id, payment_id, customer_name, customer_phone, amount, amount_paise, status, notes, razorpay_payload, created_at')
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(10000);

      if (!paymentError && Array.isArray(paymentRows)) {
        totalLinkGeneratedCount = paymentRows.length;

        for (const row of paymentRows) {
          const baseAmount =
            row?.amount != null
              ? Number(row.amount)
              : row?.amount_paise != null
                ? Number(row.amount_paise) / 100
                : 0;
          const safeAmount = Number.isFinite(baseAmount) ? baseAmount : 0;
          totalLinkGeneratedAmount += safeAmount;

          const payload = row?.razorpay_payload && typeof row.razorpay_payload === 'object' ? row.razorpay_payload : {};
          const notes = row?.notes && typeof row?.notes === 'object' ? row.notes : {};
          const status = String(row?.status || '').toUpperCase();
          const capturedPaise = Number(payload?.amount_captured || 0);
          const refundedPaise = Number(payload?.amount_refunded || 0);

          const capturedAmount =
            capturedPaise > 0
              ? capturedPaise / 100
              : ['SUCCESS', 'PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(status)
                ? safeAmount
                : 0;
          if (capturedAmount > 0) {
            totalCapturedPaymentCount += 1;
            totalCapturedPaymentAmount += capturedAmount;
          }

          const refundedAmount =
            refundedPaise > 0
              ? refundedPaise / 100
              : ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(status)
                ? safeAmount
                : 0;
          if (refundedAmount > 0) {
            totalRefundCount += 1;
            totalRefundAmount += refundedAmount;
          }

          paymentRowsForTable.push({
            order_id: row?.order_id ? String(row.order_id) : null,
            payment_id: row?.payment_id ? String(row.payment_id) : null,
            customer_name: row?.customer_name ? String(row.customer_name) : null,
            customer_phone: row?.customer_phone ? String(row.customer_phone) : null,
            employee_name: notes?.generated_by_name ? String(notes.generated_by_name) : null,
            employee_role: notes?.generated_by_role ? String(notes.generated_by_role) : null,
            status: row?.status ? String(row.status) : null,
            amount: safeAmount,
            captured_amount: capturedAmount,
            refunded_amount: refundedAmount,
            created_at: row?.created_at ? String(row.created_at) : null,
          });
        }
      }
    } catch {
      // Non-fatal: keep payment KPIs as 0 if table/schema not available.
    }

    return NextResponse.json({
      range: { from, to },
      status_options: statusOptions,
      kpis: {
        total_requests: totalRequests,
        resolved,
        pending: Math.max(totalRequests - resolved, 0),
        avg_resolution_hours: avgResolution,
        total_quoted: totalQuoted,
        total_mechanics: totalMechanicsCount || 0,
        advance_amount: advanceAmount,
        payment_received: paymentReceived,
        payment_to_mechanic: paymentToMechanic,
        // Business rule: profit = quoted - mechanic payment
        company_profit: totalQuoted - paymentToMechanic,
        total_link_generated_count: totalLinkGeneratedCount,
        total_link_generated_amount: totalLinkGeneratedAmount,
        total_captured_payment_count: totalCapturedPaymentCount,
        total_captured_payment_amount: totalCapturedPaymentAmount,
        total_refund_count: totalRefundCount,
        total_refund_amount: totalRefundAmount,
      },
      payment_rows: paymentRowsForTable,
      breakdowns: {
        department: finalizeBreakdown(deptMap),
        district: finalizeBreakdown(districtMap),
        state: finalizeBreakdown(stateMap),
        employee: finalizeBreakdown(employeeMap),
        mechanic: finalizeBreakdown(mechanicMap, 'profit'),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
