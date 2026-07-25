export const PENDING_REFERRAL_VOUCHER_KEY = '@myfng/pending_referral_voucher_id';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local copy — avoids Metro re-export issues from shared/constants. */
export function isLabourPercentReferralReward(rewardText?: string | null): boolean {
  return /10%.*labour/i.test(String(rewardText || ''));
}

export function formatRewardExpiryLabel(opts: {
  expiresAt?: string | null;
  claimedAt?: string | null;
  defaultDays?: number;
}): string {
  const now = Date.now();
  let expiryMs: number | null = null;

  if (opts.expiresAt) {
    expiryMs = new Date(opts.expiresAt).getTime();
  } else if (opts.claimedAt && opts.defaultDays) {
    expiryMs = new Date(opts.claimedAt).getTime() + opts.defaultDays * DAY_MS;
  }

  if (expiryMs == null) {
    return opts.defaultDays ? `Expires in ${opts.defaultDays} days` : '';
  }

  const daysLeft = Math.max(0, Math.ceil((expiryMs - now) / DAY_MS));
  if (daysLeft <= 0) return 'Expired';
  if (daysLeft === 1) return 'Expires in 1 day';
  return `Expires in ${daysLeft} days`;
}

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
  if (isLabourPercentReferralReward(rewardText)) return 0;
  return 0;
}

export async function loadActiveReferralVouchers(apiFetch: <T = any>(path: string) => Promise<T>) {
  try {
    const res = await apiFetch<any>('/api/customer/referral/rewards');
    const list = Array.isArray(res?.active_vouchers)
      ? res.active_vouchers
      : Array.isArray(res?.claimed)
        ? res.claimed.filter((c: any) => c.can_redeem)
        : [];
    return list.map((v: any) => ({
      ...v,
      code: v.coupon_code || `M${v.milestone_count}`,
    }));
  } catch {
    return [];
  }
}
