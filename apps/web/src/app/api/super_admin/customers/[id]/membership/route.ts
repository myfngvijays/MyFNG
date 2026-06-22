import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  adminActivateCustomerMembership,
  adminExpireCustomerMembership,
} from '@/lib/membership-admin';
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
    return { ok: false, status: 401, error: 'Unauthorized', user: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed', user: null };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin', user: null };
  }

  return { ok: true, status: 200, error: null, user };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { id: customerId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'activate').trim().toLowerCase();

    if (action === 'expire') {
      const result = await adminExpireCustomerMembership(
        supabaseAdmin,
        customerId,
        auth.user?.id || null,
        typeof body.notes === 'string' ? body.notes.trim() || null : null,
      );
      if (!result.ok) {
        return NextResponse.json({ error: result.error, details: (result as any).details }, { status: result.status });
      }
      return NextResponse.json({ success: true, expired_count: result.expired_count });
    }

    const planId = String(body.plan_id || '').trim();
    if (!planId) {
      return NextResponse.json({ error: 'plan_id is required' }, { status: 400 });
    }

    const result = await adminActivateCustomerMembership(supabaseAdmin, {
      customerId,
      planId,
      addSecondCar: Boolean(body.add_second_car),
      primaryVehicleId: body.primary_vehicle_id || null,
      secondVehicleId: body.second_vehicle_id || null,
      primaryVehicleSnapshot:
        body.primary_vehicle_snapshot && typeof body.primary_vehicle_snapshot === 'object'
          ? body.primary_vehicle_snapshot
          : {},
      secondVehicleSnapshot:
        body.second_vehicle_snapshot && typeof body.second_vehicle_snapshot === 'object'
          ? body.second_vehicle_snapshot
          : null,
      notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
      adminUserId: auth.user?.id || null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error, details: (result as any).details }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      membership: result.membership,
      ends_at: result.ends_at,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
