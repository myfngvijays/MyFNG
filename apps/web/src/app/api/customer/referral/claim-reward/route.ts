import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer, logCustomerEvent } from '@/lib/customer-api';
import {
  DEFAULT_REFER_AND_RISE_CONFIG,
  normalizeReferAndRiseConfig,
  buildRewardMeta,
  resolveCareRewardText,
  normalizeFamilyKey,
  parseRewardComponents,
  totalRewardUses,
  remainingRewardUses,
  isReferralMembershipReward,
} from '@/lib/refer-and-rise';
import { createReferralRewardCoupon, computeReferralRewardExpiresAt } from '@/lib/referral-reward-coupon';
import { grantReferralMembershipReward } from '@/lib/referral-membership-grant';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const body = await request.json().catch(() => ({}));
  const referralCount = Number(body.referralCount);
  const familyRaw = String(body.family || '');

  if (!referralCount || !familyRaw) {
    return NextResponse.json({ error: 'referralCount and family are required' }, { status: 400 });
  }

  const family = normalizeFamilyKey(familyRaw);
  if (!family) {
    return NextResponse.json({ error: 'Invalid reward track' }, { status: 400 });
  }

  const { count: totalRewarded } = await supabaseAdmin
    .from('referral_events')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_customer_id', customer.id)
    .eq('status', 'REWARDED');

  if ((totalRewarded || 0) < referralCount) {
    return NextResponse.json({ error: 'Not enough referrals for this milestone' }, { status: 400 });
  }

  const { data: existingClaim } = await supabaseAdmin
    .from('referral_milestone_claims')
    .select('id')
    .eq('customer_id', customer.id)
    .eq('milestone_count', referralCount)
    .maybeSingle();

  if (existingClaim) {
    return NextResponse.json({ error: 'Milestone already claimed' }, { status: 400 });
  }

  const { data: configRow } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'refer_and_rise_config')
    .maybeSingle();

  let config = DEFAULT_REFER_AND_RISE_CONFIG;
  if (configRow?.setting_value) {
    try {
      config = normalizeReferAndRiseConfig(JSON.parse(configRow.setting_value));
    } catch {
      config = DEFAULT_REFER_AND_RISE_CONFIG;
    }
  }

  const milestone = config.milestones.find((m) => m.referralCount === referralCount);
  let rewardText = milestone?.rewards[family] || '';

  if (family === 'myfngCare') {
    const { data: priorCare } = await supabaseAdmin
      .from('referral_milestone_claims')
      .select('milestone_count')
      .eq('customer_id', customer.id)
      .eq('chosen_family', 'myfngCare');
    const priorCounts = (priorCare || []).map((r: any) => r.milestone_count);
    rewardText = resolveCareRewardText(referralCount, rewardText, priorCounts);
  }

  const meta = buildRewardMeta(family, rewardText);
  const rewardComponents = parseRewardComponents(rewardText);
  const usesTotal = totalRewardUses(rewardComponents);
  const usesRemaining = remainingRewardUses(rewardComponents, usesTotal);
  const rewardExpiryDays = Math.max(1, Number(config.rewardExpiryDays) || 365);
  const expiresAt = computeReferralRewardExpiresAt(rewardExpiryDays);
  const isMembershipReward = meta.reward_type === 'membership' || isReferralMembershipReward(rewardText);

  const { data: claim, error: claimError } = await supabaseAdmin
    .from('referral_milestone_claims')
    .insert({
      customer_id: customer.id,
      milestone_count: referralCount,
      chosen_family: family,
      reward_text: rewardText,
      reward_type: meta.reward_type,
      voucher_amount: meta.voucher_amount,
      blocks_wallet: true,
      status: 'CLAIMED',
      claimed_at: new Date().toISOString(),
      expires_at: expiresAt,
      reward_components: rewardComponents,
      uses_total: usesTotal,
      uses_remaining: usesRemaining,
    })
    .select('*')
    .single();

  if (claimError) {
    return NextResponse.json({ error: 'Failed to record claim' }, { status: 500 });
  }

  let couponResult: { code: string } | null = null;
  let membershipActivated = false;
  let membershipPlanName: string | null = null;

  if (isMembershipReward) {
    const grant = await grantReferralMembershipReward(
      supabaseAdmin,
      customer.id,
      rewardText,
      String(claim.id),
    );
    if (grant.ok) {
      membershipActivated = true;
      membershipPlanName = grant.planName || null;
      await supabaseAdmin
        .from('referral_milestone_claims')
        .update({
          membership_id: grant.membershipId || null,
          status: 'DELIVERED',
          delivered_at: new Date().toISOString(),
          redeemed_at: new Date().toISOString(),
          uses_remaining: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claim.id);
    }
  } else {
    couponResult = await createReferralRewardCoupon(supabaseAdmin, {
      customerId: customer.id,
      claimId: String(claim.id),
      milestoneCount: referralCount,
      rewardText,
      rewardType: meta.reward_type,
      voucherAmount: meta.voucher_amount,
      blocksWallet: true,
      expiryDays: rewardExpiryDays,
      totalUses: usesTotal,
      rewardComponents,
    });
  }

  await logCustomerEvent(supabaseAdmin, customer.id, 'milestone_reward_claimed', 'referral', {
    milestone_count: referralCount,
    family,
    reward_text: rewardText,
    reward_type: meta.reward_type,
    blocks_wallet: true,
    membership_activated: membershipActivated,
    uses_total: usesTotal,
  });

  return NextResponse.json({
    success: true,
    reward_type: meta.reward_type,
    blocks_wallet: true,
    voucher_amount: meta.voucher_amount,
    reward_text: rewardText,
    expires_at: expiresAt,
    coupon_code: couponResult?.code || null,
    membership_activated: membershipActivated,
    membership_plan_name: membershipPlanName,
    uses_total: usesTotal,
    uses_remaining: membershipActivated ? 0 : usesRemaining,
    reward_components: rewardComponents,
    claim,
  });
}
