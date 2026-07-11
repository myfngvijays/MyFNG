import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  exportMembershipCustomersCsv,
  fetchMembershipBenefitClaims,
  fetchMembershipCustomersDashboard,
  fetchMembershipCustomersList,
  fetchMembershipCustomersOverview,
} from '@/lib/membership-customers-admin';
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
    const filter = String(searchParams.get('filter') || 'ACTIVE').trim().toUpperCase();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 40), 1), 100);
    const preset = String(searchParams.get('preset') || 'last_30_days');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const platform = String(searchParams.get('platform') || 'ALL').trim().toUpperCase();
    const view = String(searchParams.get('view') || 'list').trim().toLowerCase();
    const exportCsv = searchParams.get('export') === '1';
    const exportAllActive = searchParams.get('export_scope') === 'all_active';

    if (exportCsv) {
      const csv = await exportMembershipCustomersCsv(supabaseAdmin, {
        search,
        filter,
        preset,
        start,
        end,
        exportAllActive,
        platform,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="membership-customers-${stamp}.csv"`,
        },
      });
    }

    if (view === 'benefit_claims') {
      const benefitCode = String(searchParams.get('benefit_code') || '').trim();
      if (!benefitCode) {
        return NextResponse.json({ error: 'benefit_code is required' }, { status: 400 });
      }
      const result = await fetchMembershipBenefitClaims(supabaseAdmin, {
        benefit_code: benefitCode,
        preset,
        start,
        end,
        platform,
      });
      return NextResponse.json(result);
    }

    if (view === 'dashboard') {
      const dashboard = await fetchMembershipCustomersDashboard(supabaseAdmin, { preset, start, end, platform });
      const overview = await fetchMembershipCustomersOverview(supabaseAdmin);
      return NextResponse.json({ dashboard, overview });
    }

    const [overview, list] = await Promise.all([
      fetchMembershipCustomersOverview(supabaseAdmin),
      fetchMembershipCustomersList(supabaseAdmin, {
        search,
        filter,
        page,
        limit,
        preset,
        start,
        end,
        platform,
      }),
    ]);

    return NextResponse.json({
      overview,
      dashboard: null,
      memberships: list.rows,
      range_label: list.range_label,
      pagination: {
        page,
        limit,
        total: list.total,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
