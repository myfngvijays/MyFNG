import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  applyExcludeReferralTestDummies,
  enrichCustomerListRows,
  fetchCustomerOverview,
  isReferralTestDummyCustomer,
  matchesPlatformFilter,
} from '@/lib/customer-insights-admin';
import { exportCustomersCsv } from '@/lib/admin-exports';
import { applyReportDateRangeFilter } from '@/lib/report-date-range';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed' };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN', 'APP_OPERATIONS'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin' };
  }

  return { ok: true, status: 200, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get('search') || '').trim();
    const filter = String(searchParams.get('filter') || 'ALL').trim().toUpperCase();
    const platform = String(searchParams.get('platform') || 'ALL').trim().toUpperCase();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 40), 1), 100);
    const exportCsv = searchParams.get('export') === '1';
    const preset = String(searchParams.get('preset') || 'all_time');
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (exportCsv) {
      const result = await exportCustomersCsv(supabaseAdmin, {
        search,
        filter,
        platform,
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

    const filteredMode = filter !== 'ALL' || platform !== 'ALL';
    const fetchLimit = filteredMode ? 500 : limit;
    const offset = filteredMode ? 0 : (page - 1) * limit;

    const overview = await fetchCustomerOverview(supabaseAdmin, { preset, start, end });

    let query = supabaseAdmin
      .from('customers')
      .select(
        'id, phone, email, full_name, firebase_uid, phone_verified, last_login_at, created_at, is_active, app_platform, account_status, account_status_reason, account_status_changed_at',
        {
        count: 'exact',
      },
      )
      .order('created_at', { ascending: false });

    query = applyExcludeReferralTestDummies(query);
    query = applyReportDateRangeFilter(query, 'created_at', preset, start, end);

    if (search) {
      query = query.or(
        [`full_name.ilike.%${search}%`, `phone.ilike.%${search}%`, `email.ilike.%${search}%`].join(','),
      );
    }

    if (filteredMode) {
      query = query.limit(fetchLimit);
    } else {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch customers', details: error.message }, { status: 500 });
    }

    let customers = await enrichCustomerListRows(supabaseAdmin, data || []);
    customers = customers.filter((c) => !isReferralTestDummyCustomer(c));

    if (filter === 'WITH_BOOKING') {
      customers = customers.filter((c) => c.bookings_count > 0);
    } else if (filter === 'WITH_MEMBERSHIP') {
      customers = customers.filter((c) => c.has_membership);
    } else if (filter === 'WITH_WALLET') {
      customers = customers.filter((c) => Number(c.wallet_balance || 0) > 0);
    } else if (filter === 'WITH_COUPON') {
      customers = customers.filter(
        (c) => c.coupon_assigned_count > 0 || c.coupon_bookings_count > 0 || c.coupon_redeemed_count > 0,
      );
    } else if (filter === 'PUSH_ON') {
      customers = customers.filter((c) => c.push_status === 'ON');
    } else if (filter === 'PUSH_OFF') {
      customers = customers.filter((c) => c.push_status === 'OFF');
    } else if (filter === 'PUSH_NO_TOKEN') {
      customers = customers.filter((c) => c.push_status === 'NO_TOKEN');
    }

    if (platform !== 'ALL') {
      customers = customers.filter((c) => matchesPlatformFilter(c.app_platform, platform));
    }

    const totalFiltered = filteredMode ? customers.length : count || 0;
    const pagedCustomers = filteredMode
      ? customers.slice((page - 1) * limit, page * limit)
      : customers;

    return NextResponse.json({
      overview,
      customers: pagedCustomers,
      pagination: {
        page,
        limit,
        total: totalFiltered,
        filtered_total: pagedCustomers.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
