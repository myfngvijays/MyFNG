/**
 * Sub Admin Dialer Leads API
 * GET /api/subadmin/dialer-leads
 *   Query params:
 *     - page (default 1)
 *     - limit (default 25, max 200)
 *     - search (matches phone_no, name, car_number, dialer_id, remark)
 *     - disposition (single value or comma-separated list)
 *     - dialer_id (single value or comma-separated list)
 *     - from (YYYY-MM-DD, inclusive, against created_at)
 *     - to   (YYYY-MM-DD, inclusive, against created_at)
 *
 * Returns: { leads, pagination, stats: { total, today, interested, by_disposition[], by_dialer[] } }
 *
 * Auth: Only SUB_ADMIN (CSE department) or SUPER_ADMIN are allowed.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Supabase REST default caps a single response at 1000 rows. To get accurate
// distinct + count aggregations over a (potentially) large table we paginate
// through the rows in chunks. We hard-cap the total scan to avoid blowing up
// memory if the table grows very large.
const AGG_CHUNK_SIZE = 1000;
const AGG_MAX_ROWS = 100000;

async function fetchAllForAggregation(
  db: any,
  fromIso: string | null,
  toIso: string | null,
): Promise<{ disposition: string | null; dialer_id: string | null }[]> {
  const all: { disposition: string | null; dialer_id: string | null }[] = [];
  let start = 0;
  while (start < AGG_MAX_ROWS) {
    let q = db.from('dialer_leads').select('disposition, dialer_id');
    if (fromIso) q = q.gte('created_at', fromIso);
    if (toIso) q = q.lte('created_at', toIso);
    q = q.order('created_at', { ascending: false }).range(start, start + AGG_CHUNK_SIZE - 1);
    const { data, error } = await q;
    if (error) {
      console.error('Aggregation chunk error:', error);
      break;
    }
    const rows = (data as any[]) || [];
    all.push(...rows);
    if (rows.length < AGG_CHUNK_SIZE) break;
    start += AGG_CHUNK_SIZE;
  }
  return all;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('users_login')
      .select('id, department, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = ((profile as any).roles)?.role_code;
    const department = (profile as any).department;

    const isSuper = roleCode === 'SUPER_ADMIN';
    const isCseSubAdmin = roleCode === 'SUB_ADMIN' && department === 'CSE';
    if (!isSuper && !isCseSubAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: CSE Sub Admin (or Super Admin) access only' },
        { status: 403 }
      );
    }

    // Prefer admin client to bypass RLS edge cases (auth is already verified above).
    const { supabaseAdmin } = getSupabaseAdmin();
    const db: any = supabaseAdmin ?? supabase;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limitRaw = parseInt(searchParams.get('limit') || '25', 10) || 25;
    const limit = Math.min(200, Math.max(1, limitRaw));
    const offset = (page - 1) * limit;
    const search = (searchParams.get('search') || '').trim();
    const dispositionParam = (searchParams.get('disposition') || '').trim();
    const dialerIdParam = (searchParams.get('dialer_id') || '').trim();
    const fromDate = (searchParams.get('from') || '').trim();
    const toDate = (searchParams.get('to') || '').trim();

    const fromIso = fromDate ? `${fromDate}T00:00:00.000Z` : null;
    const toIso = toDate ? `${toDate}T23:59:59.999Z` : null;

    // ----- Main list query -----
    let query = db
      .from('dialer_leads')
      .select(
        'id, phone_no, name, address, regdate, car_number, make, model, disposition, remark, dialer_id, recording_url, intrested_customer_date, created_at',
        { count: 'exact' }
      );

    if (search) {
      const esc = search.replace(/[%,]/g, ' ').trim();
      query = query.or(
        `phone_no.ilike.%${esc}%,name.ilike.%${esc}%,car_number.ilike.%${esc}%,dialer_id.ilike.%${esc}%,remark.ilike.%${esc}%`
      );
    }

    if (dispositionParam) {
      const list = dispositionParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (list.length === 1) {
        query = query.eq('disposition', list[0]);
      } else if (list.length > 1) {
        query = query.in('disposition', list);
      }
    }

    if (dialerIdParam) {
      const list = dialerIdParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (list.length === 1) {
        query = query.eq('dialer_id', list[0]);
      } else if (list.length > 1) {
        query = query.in('dialer_id', list);
      }
    }

    if (fromIso) {
      query = query.gte('created_at', fromIso);
    }
    if (toIso) {
      query = query.lte('created_at', toIso);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: leads, error: leadsError, count } = await query;
    if (leadsError) {
      console.error('Error fetching dialer leads:', leadsError);
      return NextResponse.json(
        { error: 'Failed to fetch dialer leads', details: leadsError.message },
        { status: 500 }
      );
    }

    // ----- Stats -----
    // Headline counters always reflect the global table (independent of filters),
    // so dashboard "Total / Today / Interested" stay stable while users filter.
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();

    // Aggregation rows respect the current date range so the chart + dropdown
    // reflect what the user is actually looking at.
    const [totalRes, todayRes, interestedRes, aggRows] = await Promise.all([
      db.from('dialer_leads').select('id', { count: 'exact', head: true }),
      db.from('dialer_leads').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
      db
        .from('dialer_leads')
        .select('id', { count: 'exact', head: true })
        .not('intrested_customer_date', 'is', null),
      fetchAllForAggregation(db, fromIso, toIso),
    ]);

    const dispositionCounts = new Map<string, number>();
    const dialerCounts = new Map<string, number>();
    for (const row of aggRows) {
      const dKey = (row.disposition && String(row.disposition).trim()) || 'Unknown';
      dispositionCounts.set(dKey, (dispositionCounts.get(dKey) || 0) + 1);

      const idKey = (row.dialer_id && String(row.dialer_id).trim()) || 'Unknown';
      dialerCounts.set(idKey, (dialerCounts.get(idKey) || 0) + 1);
    }
    const byDisposition = Array.from(dispositionCounts.entries())
      .map(([disposition, value]) => ({ disposition, count: value }))
      .sort((a, b) => b.count - a.count);
    const byDialer = Array.from(dialerCounts.entries())
      .map(([dialer_id, value]) => ({ dialer_id, count: value }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      leads: leads || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.max(1, Math.ceil((count || 0) / limit)),
      },
      stats: {
        total: totalRes?.count || 0,
        today: todayRes?.count || 0,
        interested: interestedRes?.count || 0,
        by_disposition: byDisposition,
        by_dialer: byDialer,
        agg_rows_scanned: aggRows.length,
        agg_truncated: aggRows.length >= AGG_MAX_ROWS,
      },
      filters: {
        search: search || null,
        disposition: dispositionParam || null,
        dialer_id: dialerIdParam || null,
        from: fromDate || null,
        to: toDate || null,
      },
    });
  } catch (e: any) {
    console.error('Error in GET /api/subadmin/dialer-leads:', e);
    return NextResponse.json(
      { error: 'Internal server error', details: e?.message },
      { status: 500 }
    );
  }
}
