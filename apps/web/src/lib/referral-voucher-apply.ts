import {
  normalizeFamilyKey,
  parseVoucherAmount,
  rewardBlocksWallet,
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

  if (/10%.*labour/i.test(rewardText)) {
    return Math.min(Math.round(base * 0.1), base);
  }

  return 0;
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

  if (claim.redeemed_at || claim.status === 'DELIVERED') {
    return { discount: 0, claim: null, blocksWallet: false, rewardText: '', error: 'This referral reward was already used' };
  }

  if (claim.status === 'CANCELLED') {
    return { discount: 0, claim: null, blocksWallet: false, rewardText: '', error: 'This referral reward is no longer valid' };
  }

  const family = normalizeFamilyKey(claim.chosen_family);
  const rewardText = String(claim.reward_text || '');
  const blocksWallet =
    Boolean(claim.blocks_wallet) || (family ? rewardBlocksWallet(family, rewardText) : false);

  const discount = computeReferralVoucherDiscount(
    rewardText,
    claim.voucher_amount != null ? Number(claim.voucher_amount) : null,
    payableBase,
  );

  if (discount <= 0 && /voucher|discount/i.test(rewardText)) {
    return {
      discount: 0,
      claim,
      blocksWallet,
      rewardText,
      error: 'This referral reward cannot be applied to the current payable amount',
    };
  }

  return { discount, claim, blocksWallet, rewardText };
}

export async function redeemReferralVoucherClaim(
  supabaseAdmin: any,
  claimId: string,
  leadId: string,
) {
  await supabaseAdmin
    .from('referral_milestone_claims')
    .update({
      status: 'DELIVERED',
      redeemed_at: new Date().toISOString(),
      redeemed_lead_id: leadId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', claimId);
}
