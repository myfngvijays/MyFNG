import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { enrichBookingLead, filterBookingLeads, enrichLeadsServiceDisplay } from '@/lib/booking-lead-utils';
import { getPostBookingMembershipConfig } from '@/lib/post-booking-membership-config';
import { enrichServiceLeadPricingForAdmin } from '@/lib/post-booking-membership-offer';
import { exportServiceLeadsCsv } from '@/lib/admin-exports';
import { applyReportDateRangeFilter } from '@/lib/report-date-range';
import { PANEL_ACCESS_ROLES } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Columns needed for bookings table / filters — avoid select('*') on large meta-heavy rows. */
const LEADS_LIST_SELECT = [
  'id',
  'lead_number',
  'customer_name',
  'customer_phone',
  'customer_email',
  'vehicle_number',
  'vehicle_make',
  'vehicle_model',
  'city',
  'pincode',
  'address',
  'status',
  'lead_type',
  'service_type',
  'service_type_id',
  'lead_source',
  'created_from',
  'coupon_code',
  'coupon_meta',
  'discount_amount',
  'estimated_amount',
  'actual_amount',
  'workshop_id',
  'assigned_telecaller_id',
  'meta',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'created_at',
  'updated_at',
  'accepted_at',
  'completed_at',
  'deleted_at',
  'sla_status',
].join(',');

async function assertBookingsAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  let authUser = user;
  if (userError || !authUser) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    authUser = session?.user ?? null;
  }

  if (!authUser) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  const db = supabaseAdmin || supabase;
  const profile = await resolveUserProfile(db as any, authUser);
  const roleCode = String((profile as any)?.roles?.role_code || '');

  if (!PANEL_ACCESS_ROLES.bookings.includes(roleCode as any)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin' };
  }

  return { ok: true, status: 200, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await assertBookingsAdmin(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get('search') || '').trim();
    const status = String(searchParams.get('status') || 'ALL').trim().toUpperCase();
    const source = String(searchParams.get('source') || 'ALL').trim().toUpperCase();
    const hasCoupon = String(searchParams.get('has_coupon') || 'ALL').trim().toUpperCase();
    // Default high enough for admin board; paginate below (was hard-capped at 200).
    const requestedLimit = Number(searchParams.get('limit') || 10000);
    const maxRows = Math.min(
      Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 10000,
      20000,
    );
    const exportCsv = searchParams.get('export') === '1';
    const preset = String(searchParams.get('preset') || 'last_30_days');
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (exportCsv) {
      const result = await exportServiceLeadsCsv(supabaseAdmin, {
        search,
        status,
        source,
        hasCoupon,
        preset,
        start,
        end,
      });
      return new NextResponse(result.csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${result.filename}"`,
        },
      });
    }

    const applyCommonFilters = (q: any) => {
      let next = applyReportDateRangeFilter(q, 'created_at', preset, start, end);
      if (status && status !== 'ALL') next = next.eq('status', status);
      if (search) {
        next = next.or(
          [
            `lead_number.ilike.%${search}%`,
            `customer_name.ilike.%${search}%`,
            `customer_phone.ilike.%${search}%`,
            `vehicle_number.ilike.%${search}%`,
            `city.ilike.%${search}%`,
            `service_type.ilike.%${search}%`,
            `coupon_code.ilike.%${search}%`,
            `lead_source.ilike.%${search}%`,
            `created_from.ilike.%${search}%`,
          ].join(','),
        );
      }
      return next;
    };

    const PAGE_SIZE = 1000;
    const maxPages = Math.max(1, Math.ceil(maxRows / PAGE_SIZE));

    const fetchPaged = async (opts: {
      select: string;
      withDeletedAtFilter: boolean;
    }) => {
      const rows: any[] = [];
      let lastError: any = null;

      for (let page = 0; page < maxPages && rows.length < maxRows; page++) {
        const from = page * PAGE_SIZE;
        const to = Math.min(from + PAGE_SIZE - 1, maxRows - 1);
        let q = supabaseAdmin
          .from('service_leads')
          .select(opts.select)
          .order('created_at', { ascending: false })
          .range(from, to);
        if (opts.withDeletedAtFilter) q = q.is('deleted_at', null);
        q = applyCommonFilters(q);

        const { data, error } = await q;
        if (error) {
          lastError = error;
          break;
        }
        const batch = data || [];
        rows.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }

      return { rows, error: lastError };
    };

    let { rows: data, error } = await fetchPaged({
      select: LEADS_LIST_SELECT,
      withDeletedAtFilter: true,
    });

    // Older DBs may not have deleted_at — retry without soft-delete filter.
    if (error && /deleted_at/i.test(String(error.message || ''))) {
      ({ rows: data, error } = await fetchPaged({
        select: LEADS_LIST_SELECT,
        withDeletedAtFilter: false,
      }));
    }

    // If lean select fails (unknown column), fall back to * so the board still loads.
    if (error && /column|does not exist|Could not find/i.test(String(error.message || ''))) {
      ({ rows: data, error } = await fetchPaged({
        select: '*',
        withDeletedAtFilter: true,
      }));
      if (error && /deleted_at/i.test(String(error.message || ''))) {
        ({ rows: data, error } = await fetchPaged({
          select: '*',
          withDeletedAtFilter: false,
        }));
      }
    }

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch service leads' }, { status: 500 });
    }

    // Exact count in selected date range (before client-side source/coupon filters).
    let totalInRange: number | null = null;
    try {
      let countQuery = supabaseAdmin
        .from('service_leads')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null);
      countQuery = applyCommonFilters(countQuery);
      const countRes = await countQuery;
      if (countRes.error && /deleted_at/i.test(String(countRes.error.message || ''))) {
        let retryCount = supabaseAdmin
          .from('service_leads')
          .select('id', { count: 'exact', head: true });
        retryCount = applyCommonFilters(retryCount);
        const retryRes = await retryCount;
        totalInRange = typeof retryRes.count === 'number' ? retryRes.count : null;
      } else {
        totalInRange = typeof countRes.count === 'number' ? countRes.count : null;
      }
    } catch {
      totalInRange = null;
    }

    let leads = (data || []).map((lead) => enrichBookingLead(lead as Record<string, any>));

    leads = filterBookingLeads(leads, { source, hasCoupon, search: '' });

    // List view: enrich pricing in-memory only. Do NOT run per-lead expire/sync DB writes
    // (that made App Ops / Super Admin bookings hang for a long time on "Loading records...").
    const pbConfig = await getPostBookingMembershipConfig(supabaseAdmin);
    leads = leads.map((lead) => enrichServiceLeadPricingForAdmin(lead, pbConfig));

    await enrichLeadsServiceDisplay(supabaseAdmin, leads);

    // Attach assigned telecaller display name (batch lookup — no N+1).
    const telecallerIds = [
      ...new Set(
        leads
          .map((lead) => String((lead as any)?.assigned_telecaller_id || '').trim())
          .filter(Boolean)
      ),
    ];
    if (telecallerIds.length > 0) {
      const { data: telecallerRows } = await supabaseAdmin
        .from('users_login')
        .select('id, full_name, phone, email')
        .in('id', telecallerIds);
      const nameById = new Map(
        (telecallerRows || []).map((row: any) => [
          String(row.id),
          String(row.full_name || row.phone || row.email || 'Telecaller').trim() || 'Telecaller',
        ])
      );
      leads = leads.map((lead) => {
        const tid = String((lead as any)?.assigned_telecaller_id || '').trim();
        return {
          ...lead,
          assigned_telecaller_name: tid ? nameById.get(tid) || null : null,
        };
      });
    } else {
      leads = leads.map((lead) => ({ ...lead, assigned_telecaller_name: null }));
    }

    const totalFetched = (data || []).length;
    const truncated = typeof totalInRange === 'number' ? totalFetched < totalInRange : false;

    return NextResponse.json({
      leads,
      summary: {
        total_fetched: totalFetched,
        total_filtered: leads.length,
        total_in_range: totalInRange,
        truncated,
        max_rows: maxRows,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}

