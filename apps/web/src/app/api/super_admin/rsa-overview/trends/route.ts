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

function dateKeyUTC(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD in UTC
}

const IST_OFFSET_MS = 330 * 60 * 1000;

function dateKeyIST(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return ist.toISOString().slice(0, 10); // YYYY-MM-DD in IST (shifted)
}

function addDaysUTC(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildDateRangeUTC(fromISO: string, toISO: string) {
  const fromKey = dateKeyUTC(fromISO) || new Date().toISOString().slice(0, 10);
  const toKey = dateKeyUTC(toISO) || fromKey;
  const out: string[] = [];
  let cursor = fromKey;
  // guard against bad ranges
  for (let i = 0; i < 366; i++) {
    out.push(cursor);
    if (cursor >= toKey) break;
    cursor = addDaysUTC(cursor, 1);
  }
  return { fromKey, toKey, keys: out };
}

function hourKeyUTC(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // YYYY-MM-DDTHH:00Z
  const ymd = d.toISOString().slice(0, 10);
  const hh = d.toISOString().slice(11, 13);
  return `${ymd}T${hh}:00Z`;
}

function hourKeyIST(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const ymd = ist.toISOString().slice(0, 10);
  const hh = ist.toISOString().slice(11, 13);
  return `${ymd}T${hh}:00Z`;
}

function addHoursUTC(key: string, hours: number) {
  // key: YYYY-MM-DDTHH:00Z
  const iso = key.replace('Z', ':00.000Z').replace(/T(\d{2}):00Z$/, 'T$1:00:00.000Z');
  const d = new Date(iso);
  d.setUTCHours(d.getUTCHours() + hours);
  const ymd = d.toISOString().slice(0, 10);
  const hh = d.toISOString().slice(11, 13);
  return `${ymd}T${hh}:00Z`;
}

function buildHourRangeUTC(fromISO: string, toISO: string) {
  const start = new Date(fromISO);
  const end = new Date(toISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10);
    return { fromKey: `${ymd}T00:00Z`, toKey: `${ymd}T23:00Z`, keys: Array.from({ length: 24 }, (_, i) => `${ymd}T${String(i).padStart(2, '0')}:00Z`) };
  }
  // floor to hour
  start.setUTCMinutes(0, 0, 0);
  end.setUTCMinutes(0, 0, 0);
  const fromKey = `${start.toISOString().slice(0, 10)}T${start.toISOString().slice(11, 13)}:00Z`;
  const toKey = `${end.toISOString().slice(0, 10)}T${end.toISOString().slice(11, 13)}:00Z`;
  const keys: string[] = [];
  let cursor = fromKey;
  for (let i = 0; i < 24 * 8; i++) {
    keys.push(cursor);
    if (cursor >= toKey) break;
    cursor = addHoursUTC(cursor, 1);
  }
  return { fromKey, toKey, keys };
}

function buildDateRangeIST(fromISO: string, toISO: string) {
  const fromKey = dateKeyIST(fromISO) || dateKeyIST(new Date().toISOString())!;
  const toKey = dateKeyIST(toISO) || fromKey;
  const out: string[] = [];
  let cursor = fromKey;
  for (let i = 0; i < 366; i++) {
    out.push(cursor);
    if (cursor >= toKey) break;
    cursor = addDaysUTC(cursor, 1);
  }
  return { fromKey, toKey, keys: out };
}

function buildHourRangeIST(fromISO: string, toISO: string) {
  const start = new Date(fromISO);
  const end = new Date(toISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const now = new Date(Date.now() + IST_OFFSET_MS);
    const ymd = now.toISOString().slice(0, 10);
    return {
      fromKey: `${ymd}T00:00Z`,
      toKey: `${ymd}T23:00Z`,
      keys: Array.from({ length: 24 }, (_, i) => `${ymd}T${String(i).padStart(2, '0')}:00Z`),
    };
  }
  const startIST = new Date(start.getTime() + IST_OFFSET_MS);
  const endIST = new Date(end.getTime() + IST_OFFSET_MS);
  startIST.setUTCMinutes(0, 0, 0);
  endIST.setUTCMinutes(0, 0, 0);
  const fromKey = `${startIST.toISOString().slice(0, 10)}T${startIST.toISOString().slice(11, 13)}:00Z`;
  const toKey = `${endIST.toISOString().slice(0, 10)}T${endIST.toISOString().slice(11, 13)}:00Z`;
  const keys: string[] = [];
  let cursor = fromKey;
  for (let i = 0; i < 24 * 8; i++) {
    keys.push(cursor);
    if (cursor >= toKey) break;
    cursor = addHoursUTC(cursor, 1);
  }
  return { fromKey, toKey, keys };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const from = searchParams.get('from') || defaultFrom.toISOString();
    const to = searchParams.get('to') || now.toISOString();

    const rangeDay = buildDateRangeIST(from, to);
    const isSingleDay = rangeDay.fromKey === rangeDay.toKey;

    const dateFilter = `and(lead_registered_at.gte.${from},lead_registered_at.lte.${to}),and(requested_at.gte.${from},requested_at.lte.${to})`;
    const { data: leads, error } = await db
      .from('rsa_leads')
      .select(
        `
        id,
        lead_registered_at,
        requested_at,
        lead_status,
        complaint_status,
        customer_quoted_amount,
        advance_payment,
        payment_to_mechanic
      `
      )
      .eq('delete_status', false)
      .or(dateFilter);

    if (error) {
      return NextResponse.json({ error: 'Failed to load trend data' }, { status: 500 });
    }

    const rows = Array.isArray(leads) ? leads : [];
    const agg = new Map<string, any>();

    for (const lead of rows) {
      const stamp = lead?.lead_registered_at || lead?.requested_at;
      const key = isSingleDay ? hourKeyIST(stamp) : dateKeyIST(stamp);
      if (!key) continue;
      const entry = agg.get(key) || {
        date: key, // day key OR hour key
        total_requests: 0,
        resolved: 0,
        total_quoted: 0,
        mechanic_payment: 0,
        advance_amount: 0,
        company_profit: 0,
      };

      const quoted = toNumber(lead?.customer_quoted_amount || 0);
      const mechanic = toNumber(lead?.payment_to_mechanic || 0);
      const adv = parseAmount(lead?.advance_payment);
      const profit = quoted - mechanic;

      entry.total_requests += 1;
      if (isResolved(lead)) entry.resolved += 1;
      entry.total_quoted += quoted;
      entry.mechanic_payment += mechanic;
      entry.advance_amount += adv;
      entry.company_profit += profit;

      agg.set(key, entry);
    }

    const range = isSingleDay ? buildHourRangeIST(from, to) : rangeDay;
    const points = range.keys.map((k: string) => {
      const row = agg.get(k);
      return (
        row || {
          date: k,
          total_requests: 0,
          resolved: 0,
          total_quoted: 0,
          mechanic_payment: 0,
          advance_amount: 0,
          company_profit: 0,
        }
      );
    });

    return NextResponse.json({
      granularity: isSingleDay ? 'hour' : 'day',
      range: { from, to, from_date: range.fromKey, to_date: range.toKey },
      points,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

