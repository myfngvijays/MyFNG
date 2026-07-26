import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { enrichBookingLead, filterBookingLeads, enrichLeadsServiceDisplay } from '@/lib/booking-lead-utils';
import { getPostBookingMembershipConfig } from '@/lib/post-booking-membership-config';
import { syncServiceLeadMembershipPricingForAdmin } from '@/lib/post-booking-membership-offer';
import { exportServiceLeadsCsv } from '@/lib/admin-exports';
import { applyReportDateRangeFilter } from '@/lib/report-date-range';
import { PANEL_ACCESS_ROLES } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    const limit = Math.min(Number(searchParams.get('limit') || 500), 1000);
    const exportCsv = searchParams.get('export') === '1';
    const preset = String(searchParams.get('preset') || 'all_time');
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

    let query = supabaseAdmin
      .from('service_leads')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(Number.isFinite(limit) && limit > 0 ? limit : 200);

    query = applyReportDateRangeFilter(query, 'created_at', preset, start, end);

    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(
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
        ].join(',')
      );
    }

    let { data, error } = await query;

    // Older DBs may not have deleted_at — retry without soft-delete filter.
    if (error && /deleted_at/i.test(String(error.message || ''))) {
      let fallback = supabaseAdmin
        .from('service_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Number.isFinite(limit) && limit > 0 ? limit : 200);
      fallback = applyReportDateRangeFilter(fallback, 'created_at', preset, start, end);
      if (status && status !== 'ALL') fallback = fallback.eq('status', status);
      if (search) {
        fallback = fallback.or(
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
      ({ data, error } = await fallback);
    }

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch service leads' }, { status: 500 });
    }

    let leads = (data || []).map((lead) => enrichBookingLead(lead as Record<string, any>));

    leads = filterBookingLeads(leads, { source, hasCoupon, search: '' });

    const pbConfig = await getPostBookingMembershipConfig(supabaseAdmin);
    leads = await Promise.all(
      leads.map((lead) => syncServiceLeadMembershipPricingForAdmin(supabaseAdmin, lead, pbConfig)),
    );

    await enrichLeadsServiceDisplay(supabaseAdmin, leads);

    return NextResponse.json({
      leads,
      summary: {
        total_fetched: (data || []).length,
        total_filtered: leads.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}

