import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncCustomerReviewsFromGmb } from '@/lib/customer-reviews-gmb-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userData } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  const roleCode = (userData as any)?.roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const, status: 200, error: null };
}

/**
 * POST /api/super_admin/customer-reviews/sync-gmb
 * Body: { screen?: 'home'|'rsa'|'both', min_stars?: 4|5, location_name?, place_id? }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const result = await syncCustomerReviewsFromGmb({
      screen: body?.screen,
      minStars: body?.min_stars ?? body?.minStars ?? 4,
      locationName: body?.location_name || body?.locationName || null,
      placeId: body?.place_id || body?.placeId || null,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Sync failed' }, { status: 500 });
  }
}
