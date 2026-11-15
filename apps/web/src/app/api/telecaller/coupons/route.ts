import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

function isNowWithinWindow(coupon: any, nowIso: string) {
  if (coupon?.start_at && String(coupon.start_at) > nowIso) return false;
  if (coupon?.end_at && String(coupon.end_at) < nowIso) return false;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase, user);
    const roleCode = (userProfile?.roles as any)?.role_code || null;
    if (roleCode !== 'TELECALLER' && roleCode !== 'LEAD_MANAGER' && roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const nowIso = new Date().toISOString();

    const { data: coupons, error } = await supabaseAdmin
      .from('coupons')
      .select(
        'id, code, coupon_kind, discount_mode, discount_value, min_order_value, target_custom_label, target_service_type_id, target_subservice_id, start_at, end_at, is_active, description, applicable_city_ids, applicable_service_type_ids, coupon_type_slug, campaign_name'
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const isReferAndRiseCoupon = (c: any) => {
      const slug = String(c?.coupon_type_slug || '').toLowerCase();
      if (slug === 'referral') return true;
      const blob = [c?.code, c?.description, c?.campaign_name, c?.target_custom_label]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      return /refer\s*&\s*rise|refer\s+and\s+rise|\breferral\b/.test(blob);
    };

    const filtered = (coupons || [])
      .filter((c: any) => isNowWithinWindow(c, nowIso))
      .filter((c: any) => !isReferAndRiseCoupon(c))
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
