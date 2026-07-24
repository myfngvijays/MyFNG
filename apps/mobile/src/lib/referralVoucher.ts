export const PENDING_REFERRAL_VOUCHER_KEY = '@myfng/pending_referral_voucher_id';

export function parseVoucherAmount(rewardText: string): number | null {
  const match = String(rewardText || '').match(/₹([\d,]+)/);
  if (!match) return null;
  return Number(match[1].replace(/,/g, ''));
}

export function computeReferralVoucherDiscount(
  rewardText: string,
  voucherAmount: number | null | undefined,
  payable: number,
): number {
  const base = Math.max(0, payable);
  if (base <= 0) return 0;
  const amount = voucherAmount ?? parseVoucherAmount(rewardText);
  if (amount && amount > 0) return Math.min(Number(amount), base);
  if (/10%.*labour/i.test(rewardText)) return Math.min(Math.round(base * 0.1), base);
  return 0;
}

export async function loadActiveReferralVouchers(apiFetch: <T = any>(path: string) => Promise<T>) {
  try {
    const res = await apiFetch<any>('/api/customer/referral/rewards');
    if (Array.isArray(res?.active_vouchers) && res.active_vouchers.length > 0) {
      return res.active_vouchers;
    }
    if (Array.isArray(res?.claimed)) {
      return res.claimed.filter((c: any) => c.can_redeem && c.blocks_wallet);
    }
  } catch {
    // fallback below
  }

  try {
    const referralRes = await apiFetch<any>('/api/customer/referral');
    const picks = referralRes?.refer_and_rise?.picks || {};
    const out: any[] = [];
    for (const [count, fam] of Object.entries(picks)) {
      if (fam === 'myfngSave' || String(fam) === 'saveMoney') {
        out.push({
          id: `pick-${count}`,
          milestone_count: Number(count),
          reward_text: `₹500 Service Voucher`,
          blocks_wallet: true,
          can_redeem: true,
          chosen_family: fam,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}
