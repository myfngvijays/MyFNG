import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  fetchCouponRedemptions,
} from '@/lib/coupon-redemption-enrich';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const nowIso = new Date().toISOString();

    const [
      { data: coupons },
      assignmentResult,
      customerResult,
    ] = await Promise.all([
      supabaseAdmin.from('coupons').select('id, code, is_active, end_at, campaign_name, coupon_kind, discount_value, discount_mode'),
      supabaseAdmin.from('customer_coupon_assignments').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('customers').select('id', { count: 'exact', head: true }),
    ]);

    const assignmentCount = assignmentResult.count;
    const customerCount = customerResult.count;

    let allRedemptions: any[] = [];
    try {
      allRedemptions = await fetchCouponRedemptions(supabaseAdmin, { limit: 500 });
    } catch (redemptionErr) {
      console.error('[pcms-dashboard] redemptions fetch failed:', redemptionErr);
    }

    const allCoupons = coupons || [];
    const activeCoupons = allCoupons.filter((c: any) => c.is_active);
    const expiredCoupons = allCoupons.filter(
      (c: any) => c.end_at && String(c.end_at) < nowIso,
    );
    const campaignNames = new Set(
      allCoupons.map((c: any) => c.campaign_name).filter(Boolean),
    );

    const totalDiscount = allRedemptions.reduce(
      (sum: number, r: any) => sum + Number(r.discount_amount_applied || 0),
      0,
    );

    const channelCounts: Record<string, number> = {};
    for (const r of allRedemptions) {
      const ch = String((r as any)?.meta?.channel || 'UNKNOWN').toUpperCase();
      channelCounts[ch] = (channelCounts[ch] || 0) + 1;
    }

    const couponUsage = new Map<string, number>();
    for (const r of allRedemptions) {
      const code = String((r as any)?.coupon?.code || 'UNKNOWN');
      couponUsage.set(code, (couponUsage.get(code) || 0) + 1);
    }
    const topCoupons = [...couponUsage.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count }));

    const last14Days: Array<{ day: string; issued: number; redeemed: number }> = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const redeemed = allRedemptions.filter((r: any) => String(r.created_at || '').slice(0, 10) === key).length;
      last14Days.push({ day: key.slice(5), issued: redeemed, redeemed });
    }

    const couponsWithUsage = new Set(allRedemptions.map((r: any) => String((r as any)?.coupon?.code || '')).filter(Boolean));
    const redemptionRate =
      allCoupons.length > 0 ? Math.round((couponsWithUsage.size / allCoupons.length) * 100) : 0;

    return NextResponse.json({
      kpis: {
        total_coupons: allCoupons.length,
        active_coupons: activeCoupons.length,
        expired_coupons: expiredCoupons.length,
        total_redemptions: allRedemptions.length,
        redemption_rate: redemptionRate,
        total_discount: totalDiscount,
        active_campaigns: campaignNames.size,
        total_assignments: assignmentCount || 0,
        total_customers: customerCount || 0,
      },
      all_coupons: allCoupons,
      top_coupons: topCoupons,
      channel_breakdown: channelCounts,
      trend_14d: last14Days,
      recent_redemptions: allRedemptions.slice(0, 8),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
