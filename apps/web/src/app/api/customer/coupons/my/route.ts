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
  const customerPhone = String(customer.phone || '').replace(/\D/g, '').slice(-10);

  const queries: Promise<any>[] = [
    supabaseAdmin
      .from('coupons')
      .select('id, code, coupon_kind, discount_mode, discount_value, min_order_value, description, start_at, end_at, campaign_name, applicable_channels, is_public')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('customer_coupon_assignments')
      .select('id, expires_at, redeemed_at, notes, coupon:coupons(id, code, coupon_kind, discount_mode, discount_value, min_order_value, description, start_at, end_at, campaign_name, applicable_channels, is_active, is_public)')
      .eq('customer_id', customer.id)
      .is('redeemed_at', null),
    supabaseAdmin
      .from('customer_coupon_assignments')
      .select('coupon_id')
      .limit(500),
  ];

  // Also fetch pending phone-based assignments
  if (customerPhone.length === 10) {
    queries.push(
      supabaseAdmin
        .from('customer_coupon_assignments')
        .select('id, expires_at, redeemed_at, notes, coupon:coupons(id, code, coupon_kind, discount_mode, discount_value, min_order_value, description, start_at, end_at, campaign_name, applicable_channels, is_active, is_public)')
        .eq('pending_phone', customerPhone)
        .is('customer_id', null)
        .is('redeemed_at', null),
    );
  }

  const results = await Promise.all(queries);
  const publicCoupons = results[0].data;
  const assignments = results[1].data;
  const allAssignments = results[2].data;
  const pendingAssignments = results[3]?.data || [];

  const couponsWithAssignments = new Set(
    (allAssignments || []).map((row: any) => String(row.coupon_id)),
  );

  const assignedCoupons = [...(assignments || []), ...pendingAssignments]
    .map((row: any) => row.coupon)
    .filter(Boolean)
    .filter((coupon: any) => coupon.is_active !== false)
    .map((coupon: any) => ({ ...coupon, assigned: true }));

  const openPublic = (publicCoupons || []).filter((coupon: any) => {
    if (coupon.is_public === false) return false;
    if (!couponAppliesToChannel(coupon, channel)) return false;
    if (coupon.start_at && String(coupon.start_at) > nowIso) return false;
    if (coupon.end_at && String(coupon.end_at) < nowIso) return false;
    if (couponsWithAssignments.has(String(coupon.id))) return false;
    return true;
  });

  const merged = new Map<string, any>();
  for (const coupon of [...assignedCoupons, ...openPublic]) {
    if (!coupon?.id || coupon.is_active === false) continue;
    merged.set(String(coupon.id), coupon);
  }

  return NextResponse.json({ coupons: Array.from(merged.values()) });
}
