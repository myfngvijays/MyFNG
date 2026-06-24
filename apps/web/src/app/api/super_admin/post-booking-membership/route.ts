import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  buildPostBookingMembershipAdminStats,
  filterPostBookingMembershipAdminRows,
  getPostBookingMembershipConfig,
  normalizePostBookingMembershipConfig,
  savePostBookingMembershipConfig,
} from '@/lib/post-booking-membership-config';
import { listPostBookingMembershipAdminRows } from '@/lib/post-booking-membership-offer';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized', user: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false as const, status: 403, error: 'Forbidden - Role check failed', user: null };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden - Not super admin', user: null };
  }

  return { ok: true as const, status: 200, error: null, user };
}

async function resolveMembershipListPrice(supabaseAdmin: any): Promise<number> {
  const { data } = await supabaseAdmin
    .from('membership_plans')
    .select('price, display_order, active, code')
    .eq('active', true)
    .order('display_order', { ascending: true })
    .limit(10);

  const prime = (data || []).find((row: any) => String(row.code || '').toUpperCase().includes('PRIME'));
  const price = Number((prime || data?.[0])?.price || 699);
  return Number.isFinite(price) && price > 0 ? price : 699;
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

    const q = request.nextUrl.searchParams.get('q');
    const config = await getPostBookingMembershipConfig(supabaseAdmin);
    const membershipListPrice = await resolveMembershipListPrice(supabaseAdmin);
    const allRows = await listPostBookingMembershipAdminRows(supabaseAdmin, config, membershipListPrice);
    const rows = filterPostBookingMembershipAdminRows(allRows, q);
    const stats = buildPostBookingMembershipAdminStats(allRows);

    return NextResponse.json({
      success: true,
      config,
      membership_list_price: membershipListPrice,
      stats,
      rows,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const saved = await savePostBookingMembershipConfig(
      supabaseAdmin,
      normalizePostBookingMembershipConfig(body?.config || body),
      auth.user?.id || null,
    );

    return NextResponse.json({
      success: true,
      config: saved,
      message: 'Post-booking membership settings saved',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
