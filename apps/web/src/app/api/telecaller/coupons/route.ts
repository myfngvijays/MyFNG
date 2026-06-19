import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { couponAppliesToChannel } from '@/lib/coupon-rules';

function normalizeArrayField(value: any): string[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(String);
  // JSONB might come back as object/primitive; best-effort
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // ignore
  }
  return null;
}

function isNowWithinWindow(coupon: any, nowIso: string) {
  if (coupon?.start_at && String(coupon.start_at) > nowIso) return false;
  if (coupon?.end_at && String(coupon.end_at) < nowIso) return false;
  return true;
}

function matchesAny(list: string[] | null, candidates: string[]) {
  if (!list || list.length === 0) return true; // not restricted
  const set = new Set(list.map((v) => String(v)));
  return candidates.some((c) => set.has(String(c)));
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase, user);
    const roleCode = (userProfile?.roles as any)?.role_code || null;
    if (roleCode !== 'TELECALLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const url = new URL(request.url);
    const cityId = url.searchParams.get('city_id')?.trim() || '';
    const serviceTypeIds = (url.searchParams.get('service_type_ids') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const nowIso = new Date().toISOString();

    const { data: coupons, error } = await supabaseAdmin
      .from('coupons')
      .select(
        'id, code, coupon_kind, discount_mode, discount_value, min_order_value, target_custom_label, target_service_type_id, target_subservice_id, start_at, end_at, is_active, description, applicable_city_ids, applicable_service_type_ids'
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const filtered = (coupons || [])
      .filter((c: any) => isNowWithinWindow(c, nowIso))
      .filter((c: any) => couponAppliesToChannel(c, 'TELECALLER'))
      .filter((c: any) => {
        const applicableCities = normalizeArrayField(c.applicable_city_ids);
        const applicableServiceTypes = normalizeArrayField(c.applicable_service_type_ids);

        const cityOk = !cityId ? true : matchesAny(applicableCities, [cityId]);
        const serviceOk = serviceTypeIds.length === 0 ? true : matchesAny(applicableServiceTypes, serviceTypeIds);

        return cityOk && serviceOk;
      })
      .map((c: any) => ({
        id: c.id,
        code: c.code,
        coupon_kind: c.coupon_kind,
        discount_mode: c.discount_mode,
        discount_value: c.discount_value,
        min_order_value: c.min_order_value,
        target_custom_label: c.target_custom_label,
        target_service_type_id: c.target_service_type_id,
        target_subservice_id: c.target_subservice_id,
        description: c.description,
        start_at: c.start_at,
        end_at: c.end_at,
      }));

    return NextResponse.json({ coupons: filtered });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

