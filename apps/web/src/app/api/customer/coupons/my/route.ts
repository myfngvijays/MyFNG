import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { couponAppliesToChannel } from '@/lib/coupon-rules';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const nowIso = new Date().toISOString();
  const channel = 'MOBILE';

  const [{ data: publicCoupons }, { data: assignments }] = await Promise.all([
    supabaseAdmin
      .from('coupons')
      .select('id, code, coupon_kind, discount_mode, discount_value, min_order_value, description, start_at, end_at, campaign_name, applicable_channels')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('customer_coupon_assignments')
      .select('id, expires_at, redeemed_at, notes, coupon:coupons(id, code, coupon_kind, discount_mode, discount_value, min_order_value, description, start_at, end_at, campaign_name, applicable_channels, is_active)')
      .eq('customer_id', customer.id)
      .is('redeemed_at', null),
  ]);

  const assignedCoupons = (assignments || [])
    .map((row: any) => row.coupon)
    .filter(Boolean)
    .map((coupon: any) => ({ ...coupon, assigned: true }));

  const openPublic = (publicCoupons || []).filter((coupon: any) => {
    if (coupon.is_public === false) return false;
    if (!couponAppliesToChannel(coupon, channel)) return false;
    if (coupon.start_at && String(coupon.start_at) > nowIso) return false;
    if (coupon.end_at && String(coupon.end_at) < nowIso) return false;
    return true;
  });

  const merged = new Map<string, any>();
  for (const coupon of [...assignedCoupons, ...openPublic]) {
    if (!coupon?.id || coupon.is_active === false) continue;
    merged.set(String(coupon.id), coupon);
  }

  return NextResponse.json({ coupons: Array.from(merged.values()) });
}
