import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { couponAppliesToChannel } from '@/lib/coupon-rules';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ coupons: [], error: adminError });

  const channel = String(request.nextUrl.searchParams.get('channel') || 'ALL').toUpperCase();
  const nowIso = new Date().toISOString();

  const [{ data }, { data: assignedCouponRows }] = await Promise.all([
    supabaseAdmin
      .from('coupons')
      .select(
        'id,code,coupon_kind,discount_mode,discount_value,min_order_value,description,start_at,end_at,applicable_channels,is_public,campaign_name',
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('customer_coupon_assignments')
      .select('coupon_id')
      .limit(500),
  ]);

  if (!data) return NextResponse.json({ coupons: [] });

  const couponsWithAssignments = new Set(
    (assignedCouponRows || []).map((row: any) => String(row.coupon_id)),
  );

  const filtered = (data || []).filter((coupon: any) => {
    if (coupon.is_public === false) return false;
    if (!couponAppliesToChannel(coupon, channel)) return false;
    if (coupon.start_at && String(coupon.start_at) > nowIso) return false;
    if (coupon.end_at && String(coupon.end_at) < nowIso) return false;
    if (couponsWithAssignments.has(String(coupon.id))) return false;
    return true;
  });

  return NextResponse.json({ coupons: filtered.slice(0, 20) });
}
