import {
  normalizeFamilyKey,
  parseVoucherAmount,
  isLabourPercentReferralReward,
  parseStoredRewardComponents,
  rewardHasRemainingUses,
  remainingRewardUses,
  parseRewardComponents,
  type RewardComponent,
} from '@/lib/refer-and-rise';

export type ReferralVoucherResult = {
  discount: number;
  claim: Record<string, unknown> | null;
  blocksWallet: boolean;
  rewardText: string;
  error?: string;
};

export function computeReferralVoucherDiscount(rewardText: string, voucherAmount: number | null, payable: number): number {
  const base = Math.max(0, payable);
  if (base <= 0) return 0;

  const amount = voucherAmount ?? parseVoucherAmount(rewardText);
  if (amount && amount > 0) {
    return Math.min(Number(amount), base);
  }

  if (/10%.*labour/i.test(rewardText) || isLabourPercentReferralReward(rewardText)) {
    return 0;
  }

  return 0;
}

function resolveClaimComponents(claim: Record<string, any>): RewardComponent[] {
  const stored = parseStoredRewardComponents(claim.reward_components);
  if (stored.length > 0) return stored;
  return parseRewardComponents(String(claim.reward_text || ''));
}

function claimIsUsable(claim: Record<string, any>): string | null {
  const components = resolveClaimComponents(claim);
  const hasUses = rewardHasRemainingUses(
    components,
    claim.uses_remaining,
    claim.redeemed_at,
    claim.status,
  );

  if (!hasUses) {
    return 'This referral reward was already used';
  }

  if (claim.status === 'CANCELLED') {
    return 'This referral reward is no longer valid';
  }

  if (claim.expires_at && String(claim.expires_at) < new Date().toISOString()) {
    return 'This referral reward has expired';
  }

  if (claim.reward_type === 'membership' && claim.membership_id) {
    return 'This membership reward was already activated on claim';
  }

  return null;
}

export async function resolveReferralVoucherForBooking(
  supabaseAdmin: any,
  customerId: string,
  claimId: string,
  payableBase: number,
): Promise<ReferralVoucherResult> {
  if (!claimId) {
    return { discount: 0, claim: null, blocksWallet: false, rewardText: '' };
  }

  const { data: claim, error } = await supabaseAdmin
    .from('referral_milestone_claims')
    .select('*')
    .eq('id', claimId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error || !claim) {
    return { discount: 0, claim: null, blocksWallet: false, rewardText: '', error: 'Referral reward not found' };
  }

  const useError = claimIsUsable(claim);
  if (useError) {
    return { discount: 0, claim: null, blocksWallet: false, rewardText: '', error: useError };
  }

  const rewardText = String(claim.reward_text || '');
  const blocksWallet = true;

  const discount = computeReferralVoucherDiscount(
    rewardText,
    claim.voucher_amount != null ? Number(claim.voucher_amount) : null,
    payableBase,
  );

  if (discount <= 0 && /voucher|discount/i.test(rewardText) && !isLabourPercentReferralReward(rewardText)) {
    return {
      discount: 0,
      claim,
      blocksWallet,
      rewardText,
      error: 'This referral reward cannot be applied to the current payable amount',
    };
  }

  if (discount <= 0) {
    return { discount: 0, claim, blocksWallet, rewardText };
  }

  return { discount, claim, blocksWallet, rewardText };
}

function pickComponentToRedeem(
  components: RewardComponent[],
  opts?: { pickupRequired?: boolean },
): RewardComponent | null {
  const available = components.filter((c) => c.uses_remaining > 0);
  if (available.length === 0) return null;
  if (available.length === 1) return available[0];

  if (opts?.pickupRequired) {
    const pickup = available.find((c) => /pickup|drop/i.test(c.label));
    if (pickup) return pickup;
  }

  const nonPickup = available.find((c) => !/pickup|drop/i.test(c.label));
  return nonPickup || available[0];
}

export async function redeemReferralVoucherClaim(
  supabaseAdmin: any,
  claimId: string,
  leadId: string,
  opts?: { pickupRequired?: boolean },
) {
  const { data: claim } = await supabaseAdmin
    .from('referral_milestone_claims')
    .select('*')
    .eq('id', claimId)
    .maybeSingle();

  if (!claim) return;

  const components = resolveClaimComponents(claim);
  const nowIso = new Date().toISOString();

  if (components.length > 0) {
    const target = pickComponentToRedeem(components, opts);
    if (!target) return;

    const updated = components.map((c) =>
      c.key === target.key
        ? { ...c, uses_remaining: Math.max(0, c.uses_remaining - 1) }
        : c,
    );
    const remaining = remainingRewardUses(updated, null);

    const updatePayload: Record<string, unknown> = {
      reward_components: updated,
      uses_remaining: remaining,
      last_used_at: nowIso,
      last_used_lead_id: leadId,
      updated_at: nowIso,
    };

    if (remaining <= 0) {
      updatePayload.status = 'DELIVERED';
      updatePayload.redeemed_at = nowIso;
      updatePayload.redeemed_lead_id = leadId;
      updatePayload.delivered_at = nowIso;
    }

    await supabaseAdmin.from('referral_milestone_claims').update(updatePayload).eq('id', claimId);
    return;
  }

  await supabaseAdmin
    .from('referral_milestone_claims')
    .update({
      status: 'DELIVERED',
      redeemed_at: nowIso,
      redeemed_lead_id: leadId,
      delivered_at: nowIso,
      uses_remaining: 0,
      updated_at: nowIso,
    })
    .eq('id', claimId);
}
