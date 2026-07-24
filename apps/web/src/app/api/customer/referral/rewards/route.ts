import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import {
  DEFAULT_REFER_AND_RISE_CONFIG,
  normalizeReferAndRiseConfig,
  normalizeFamilyKey,
} from '@/lib/refer-and-rise';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ctx = await requireCustomer();
    if ('response' in ctx) return ctx.response;
    const { customer, supabaseAdmin } = ctx;

    const { count: totalRewarded } = await supabaseAdmin
      .from('referral_events')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_customer_id', customer.id)
      .eq('status', 'REWARDED');

    const rewardedCount = totalRewarded || 0;

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

    let claims: any[] = [];
    const { data: claimsData, error: claimsError } = await supabaseAdmin
      .from('referral_milestone_claims')
      .select('*')
      .eq('customer_id', customer.id)
      .order('milestone_count', { ascending: true });

    if (claimsError) {
      const { data: fallbackClaims } = await supabaseAdmin
        .from('referral_milestone_claims')
        .select('id, customer_id, milestone_count, chosen_family, reward_text, status, claimed_at')
        .eq('customer_id', customer.id)
        .order('milestone_count', { ascending: true });
      claims = fallbackClaims || [];
    } else {
      claims = claimsData || [];
    }

    const claimedByCount = new Map(claims.map((c: any) => [c.milestone_count, c]));

    const claimable = config.milestones
      .filter((m) => rewardedCount >= m.referralCount && !claimedByCount.has(m.referralCount))
      .map((m) => ({
        milestone_count: m.referralCount,
        rewards: m.rewards,
        categories: config.categories,
      }));

    const claimed = claims.map((c: any) => {
      const family = normalizeFamilyKey(c.chosen_family) || c.chosen_family;
      const cat = family ? config.categories[family as keyof typeof config.categories] : null;
      const rewardText = c.reward_text || (family && config.milestones.find((m) => m.referralCount === c.milestone_count)?.rewards[family as keyof typeof config.categories['myfngSave']]) || '';
      const blocksWallet = Boolean(c.blocks_wallet) || (family === 'myfngSave' && /voucher|discount/i.test(String(rewardText)));
      const rewardType = c.reward_type || (blocksWallet ? 'voucher' : 'service');
      return {
        id: c.id,
        milestone_count: c.milestone_count,
        chosen_family: family,
        category_name: cat?.name || c.chosen_family,
        reward_text: rewardText,
        reward_type: rewardType,
        voucher_amount: c.voucher_amount ?? null,
        blocks_wallet: blocksWallet,
        status: c.status || 'CLAIMED',
        claimed_at: c.claimed_at,
        redeemed_at: c.redeemed_at ?? null,
        can_redeem: (c.status || 'CLAIMED') === 'CLAIMED' && !c.redeemed_at,
      };
    });

    const locked = config.milestones
      .filter((m) => rewardedCount < m.referralCount)
      .map((m) => ({
        milestone_count: m.referralCount,
        referrals_needed: m.referralCount - rewardedCount,
        rewards: m.rewards,
      }));

    const activeVouchers = claimed.filter(
      (c) => c.blocks_wallet && c.can_redeem && (c.reward_type === 'voucher' || c.reward_type === 'discount'),
    );

    return NextResponse.json({
      success: true,
      stats: { total_rewarded: rewardedCount },
      milestones: config.milestones,
      categories: config.categories,
      claimable,
      claimed,
      locked,
      active_vouchers: activeVouchers,
      wallet_voucher_rule:
        'Service vouchers from MYFNG Save cannot be combined with wallet balance on the same booking.',
    });
  } catch (e: any) {
    console.error('[referral/rewards]', e);
    return NextResponse.json({ error: e?.message || 'Failed to load referral rewards' }, { status: 500 });
  }
}