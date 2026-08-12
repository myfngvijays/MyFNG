import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import { couponAppliesToChannel } from '@/lib/coupon-rules';
import { parseReferralAssignmentNotes } from '@/lib/referral-reward-coupon';
import { evaluateWelcomeCiCouponGate } from '@/lib/welcome-ci-coupon-gate';

export const dynamic = 'force-dynamic';

const COUPON_SELECT =
  'id, code, coupon_kind, discount_mode, discount_value, min_order_value, description, start_at, end_at, campaign_name, applicable_channels, is_public, is_active, coupon_type_slug';

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
      .select(COUPON_SELECT)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('customer_coupon_assignments')
      .select(`id, expires_at, redeemed_at, notes, coupon:coupons(${COUPON_SELECT})`)
      .eq('customer_id', customer.id)
      .is('redeemed_at', null),
    supabaseAdmin.from('customer_coupon_assignments').select('coupon_id').limit(500),
  ];

  if (customerPhone.length === 10) {
    queries.push(
      supabaseAdmin
        .from('customer_coupon_assignments')
        .select(`id, expires_at, redeemed_at, notes, coupon:coupons(${COUPON_SELECT})`)
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

  const assignedCoupons = await Promise.all(
    [...(assignments || []), ...pendingAssignments]
      .filter((row: any) => {
        if (row.redeemed_at) return false;
        if (row.expires_at && String(row.expires_at) < nowIso) return false;
        return Boolean(row.coupon);
      })
      .map(async (row: any) => {
        const notes = parseReferralAssignmentNotes(row.notes);
        const assignmentExpires = row.expires_at || null;
        const gate = await evaluateWelcomeCiCouponGate(
          supabaseAdmin,
          { id: customer.id, phone: customer.phone },
          row.coupon,
          row.notes,
        );
        return {
          ...row.coupon,
          end_at: assignmentExpires || row.coupon?.end_at || null,
          assigned: true,
          assignment_expires_at: assignmentExpires,
          is_referral_reward: Boolean(notes?.referral_claim_id),
          referral_claim_id: notes?.referral_claim_id || null,
          referral_reward_label: row.coupon?.description || null,
          locked: gate.gated ? gate.locked : false,
          lock_reason: gate.gated ? gate.lock_reason : null,
          unlock_message: gate.gated ? gate.message : null,
          profile_ok: gate.gated ? gate.profile_ok : true,
          service_unlocked: gate.gated ? gate.service_unlocked : true,
          can_use: gate.gated ? gate.can_use : true,
        };
      }),
  );

  const activeAssigned = assignedCoupons.filter((coupon: any) => coupon.is_active !== false);

  const openPublic = (publicCoupons || []).filter((coupon: any) => {
    if (coupon.is_public === false) return false;
    if (!couponAppliesToChannel(coupon, channel)) return false;
    if (coupon.start_at && String(coupon.start_at) > nowIso) return false;
    if (coupon.end_at && String(coupon.end_at) < nowIso) return false;
    if (couponsWithAssignments.has(String(coupon.id))) return false;
    return true;
  });

  const merged = new Map<string, any>();
  for (const coupon of [...activeAssigned, ...openPublic]) {
    if (!coupon?.id || coupon.is_active === false) continue;
    merged.set(String(coupon.id), coupon);
  }

  return NextResponse.json({ coupons: Array.from(merged.values()) });
}
