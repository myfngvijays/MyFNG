import 'server-only';
import { parseVoucherAmount, parseRewardComponents, totalRewardUses } from '@/lib/refer-and-rise';

const DEFAULT_REWARD_EXPIRY_DAYS = 365;

function randomCodeSuffix(length = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function buildReferralCouponCode(milestoneCount: number): string {
  return `REF${milestoneCount}${randomCodeSuffix()}`.slice(0, 20);
}

function resolveCouponDiscount(rewardText: string, rewardType: string, voucherAmount: number | null) {
  const text = String(rewardText || '');
  if (/10%.*labour/i.test(text) || rewardType === 'discount') {
    return { couponKind: 'TOTAL_DISCOUNT' as const, discountMode: 'PERCENT' as const, discountValue: 10 };
  }

  const amount = voucherAmount != null && Number(voucherAmount) > 0
    ? Number(voucherAmount)
    : parseVoucherAmount(text);

  if (amount && amount > 0) {
    return { couponKind: 'TOTAL_DISCOUNT' as const, discountMode: 'AMOUNT' as const, discountValue: amount };
  }

  return { couponKind: 'TOTAL_DISCOUNT' as const, discountMode: 'AMOUNT' as const, discountValue: 0 };
}

export function computeReferralRewardExpiresAt(expiryDays = DEFAULT_REWARD_EXPIRY_DAYS): string {
  const days = Math.max(1, Math.round(Number(expiryDays) || DEFAULT_REWARD_EXPIRY_DAYS));
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + days);
  return expires.toISOString();
}

export async function createReferralRewardCoupon(
  supabaseAdmin: any,
  params: {
    customerId: string;
    claimId: string;
    milestoneCount: number;
    rewardText: string;
    rewardType: string;
    voucherAmount?: number | null;
    blocksWallet?: boolean;
    expiryDays?: number;
    totalUses?: number;
    rewardComponents?: import('@/lib/refer-and-rise').RewardComponent[];
  },
): Promise<{ couponId: string; assignmentId: string; code: string; expiresAt: string } | null> {
  const customerId = String(params.customerId || '').trim();
  const claimId = String(params.claimId || '').trim();
  if (!customerId || !claimId) return null;

  const expiresAt = computeReferralRewardExpiresAt(params.expiryDays);
  const nowIso = new Date().toISOString();
  const discount = resolveCouponDiscount(params.rewardText, params.rewardType, params.voucherAmount ?? null);
  const totalUses = Math.max(1, Number(params.totalUses) || 1);

  let code = buildReferralCouponCode(params.milestoneCount);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: existing } = await supabaseAdmin
      .from('coupons')
      .select('id')
      .ilike('code', code)
      .maybeSingle();
    if (!existing) break;
    code = buildReferralCouponCode(params.milestoneCount);
  }

  const { data: coupon, error: couponError } = await supabaseAdmin
    .from('coupons')
    .insert({
      code,
      coupon_kind: discount.couponKind,
      discount_mode: discount.discountMode,
      discount_value: discount.discountValue,
      min_order_value: 0,
      description: String(params.rewardText || 'Refer & Rise Reward').trim(),
      campaign_name: `Refer & Rise · Milestone ${params.milestoneCount}`,
      coupon_type_slug: 'referral',
      is_public: false,
      is_active: true,
      usage_limit_total: totalUses,
      usage_limit_per_customer: totalUses,
      applicable_channels: ['ANDROID', 'IOS', 'WEB', 'MOBILE'],
      start_at: nowIso,
      end_at: expiresAt,
    })
    .select('id, code')
    .single();

  if (couponError || !coupon?.id) {
    console.warn('[referral-reward-coupon] coupon insert failed:', couponError);
    return null;
  }

  const assignmentNotes = JSON.stringify({
    source: 'refer_and_rise',
    referral_claim_id: claimId,
    milestone_count: params.milestoneCount,
    blocks_wallet: true,
    reward_type: params.rewardType,
    total_uses: totalUses,
    reward_components: params.rewardComponents || [],
  });

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from('customer_coupon_assignments')
    .insert({
      customer_id: customerId,
      coupon_id: coupon.id,
      expires_at: expiresAt,
      notes: assignmentNotes,
    })
    .select('id')
    .single();

  if (assignmentError || !assignment?.id) {
    console.warn('[referral-reward-coupon] assignment insert failed:', assignmentError);
    await supabaseAdmin.from('coupons').delete().eq('id', coupon.id);
    return null;
  }

  await supabaseAdmin
    .from('referral_milestone_claims')
    .update({
      expires_at: expiresAt,
      coupon_id: coupon.id,
      coupon_assignment_id: assignment.id,
      updated_at: nowIso,
    })
    .eq('id', claimId);

  return {
    couponId: String(coupon.id),
    assignmentId: String(assignment.id),
    code: String(coupon.code),
    expiresAt,
  };
}

export function parseReferralAssignmentNotes(notes: unknown): {
  referral_claim_id?: string;
  blocks_wallet?: boolean;
  milestone_count?: number;
} | null {
  if (!notes) return null;
  try {
    const parsed = typeof notes === 'string' ? JSON.parse(notes) : notes;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as { referral_claim_id?: string; blocks_wallet?: boolean; milestone_count?: number };
  } catch {
    return null;
  }
}

export async function ensureReferralRewardCouponForClaim(
  supabaseAdmin: any,
  claim: Record<string, any>,
  expiryDays = DEFAULT_REWARD_EXPIRY_DAYS,
): Promise<{ couponId: string; code: string; expiresAt: string } | null> {
  if (claim.coupon_id) {
    const { data: coupon } = await supabaseAdmin
      .from('coupons')
      .select('id, code')
      .eq('id', claim.coupon_id)
      .maybeSingle();
    if (coupon?.id) {
      return {
        couponId: String(coupon.id),
        code: String(coupon.code),
        expiresAt: String(claim.expires_at || ''),
      };
    }
  }

  if (claim.redeemed_at || claim.status === 'DELIVERED' || claim.status === 'CANCELLED') {
    return null;
  }

  const expiresAt = claim.expires_at || computeReferralRewardExpiresAt(expiryDays);
  const components = parseRewardComponents(String(claim.reward_text || ''));
  const totalUses = totalRewardUses(components);
  const created = await createReferralRewardCoupon(supabaseAdmin, {
    customerId: String(claim.customer_id),
    claimId: String(claim.id),
    milestoneCount: Number(claim.milestone_count),
    rewardText: String(claim.reward_text || ''),
    rewardType: String(claim.reward_type || 'service'),
    voucherAmount: claim.voucher_amount != null ? Number(claim.voucher_amount) : null,
    blocksWallet: true,
    expiryDays,
    totalUses,
    rewardComponents: components,
  });

  if (!created) {
    await supabaseAdmin
      .from('referral_milestone_claims')
      .update({ expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq('id', claim.id)
      .is('expires_at', null);
    return null;
  }

  return { couponId: created.couponId, code: created.code, expiresAt: created.expiresAt };
}
