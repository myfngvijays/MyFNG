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

function isResolved(lead: any) {
  const leadStatus = String(lead?.lead_status || '').toLowerCase();
  const complaintStatus = String(lead?.complaint_status || '').toLowerCase();
  return ['completed', 'closed'].includes(leadStatus) || ['completed', 'closed'].includes(complaintStatus);
}

function addToBreakdown(map: Map<string, any>, key: string, name: string, lead: any) {
  const entry = map.get(key) || {
    key,
    name,
    total: 0,
    resolved: 0,
    revenue: 0,
    mechanic_payment: 0,
    company_profit: 0,
  };
  entry.total += 1;
  if (isResolved(lead)) entry.resolved += 1;
  const revenue = toNumber(lead.payment_received || lead.customer_quoted_amount || 0);
  const mechanicPayment = toNumber(lead.payment_to_mechanic || 0);
  entry.revenue += revenue;
  entry.mechanic_payment += mechanicPayment;
  entry.company_profit += revenue - mechanicPayment;
  map.set(key, entry);
}

function finalizeBreakdown(map: Map<string, any>) {
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      rate: row.total ? (row.resolved / row.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
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
        payment_received,
        payment_to_mechanic,
        assigned_manager_id,
        assigned_manager_name,
        registered_by_id,
        registered_by_name,
        address,
        pincode
      `
      )
      .eq('delete_status', false)
      .gte('lead_registered_at', from)
      .lte('lead_registered_at', to);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch RSA overview data' }, { status: 500 });
    }

    const rows = Array.isArray(leads) ? leads : [];
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
    let paymentReceived = 0;
    let paymentToMechanic = 0;
    let resolutionSumHours = 0;
    let resolutionCount = 0;

    const deptMap = new Map<string, any>();
    const districtMap = new Map<string, any>();
    const stateMap = new Map<string, any>();
    const employeeMap = new Map<string, any>();

    for (const lead of rows) {
      const resolvedLead = isResolved(lead);
      if (resolvedLead) resolved += 1;
      totalQuoted += toNumber(lead.customer_quoted_amount || 0);
      paymentReceived += toNumber(lead.payment_received || 0);
      paymentToMechanic += toNumber(lead.payment_to_mechanic || 0);

      const started = lead.lead_registered_at ? new Date(lead.lead_registered_at) : null;
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
      const employeeLabel = `${employeeName} (${employeeId === 'Unassigned' ? '—' : employeeId.slice(0, 6)})`;
      addToBreakdown(employeeMap, employeeId, employeeLabel, lead);
    }

    const avgResolution = resolutionCount ? resolutionSumHours / resolutionCount : null;

    return NextResponse.json({
      range: { from, to },
      kpis: {
        total_requests: totalRequests,
        resolved,
        pending: Math.max(totalRequests - resolved, 0),
        avg_resolution_hours: avgResolution,
        total_quoted: totalQuoted,
        payment_received: paymentReceived,
        payment_to_mechanic: paymentToMechanic,
        company_profit: paymentReceived - paymentToMechanic,
      },
      breakdowns: {
        department: finalizeBreakdown(deptMap),
        district: finalizeBreakdown(districtMap),
        state: finalizeBreakdown(stateMap),
        employee: finalizeBreakdown(employeeMap),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
