export const WALLET_SERVICE_PERCENT = 0.1;
export const WALLET_MEMBERSHIP_PERCENT = 0.3;

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateWalletUsage(
  payableAmount: number,
  walletBalance: number,
  channel: 'SERVICE' | 'MEMBERSHIP',
  vehicleBlocked = false,
): number {
  if (vehicleBlocked || payableAmount <= 0 || walletBalance <= 0) return 0;
  const percent = channel === 'MEMBERSHIP' ? WALLET_MEMBERSHIP_PERCENT : WALLET_SERVICE_PERCENT;
  const maxFromOrder = roundMoney(payableAmount * percent);
  return roundMoney(Math.min(walletBalance, maxFromOrder));
}

export const WALLET_TERMS = [
  '₹1,000 Welcome Bonus on first app login.',
  'Valid for 90 days - unused welcome bonus expires automatically.',
  'Prime members: 5% cashback on paid service bills (up to ₹500 per bill), credited to Available Balance.',
  'Referral rewards are credited to Available Balance when your friend completes their first order.',
  'Services: use up to 10% of payable amount from wallet at checkout.',
  'Membership: use up to 30% of payable amount from wallet at checkout.',
  'All credits (welcome bonus, cashback, referral) add to Available Balance and show in Recent Activity.',
  'Wallet balance cannot be withdrawn as cash or transferred to bank.',
  'Applied at checkout - final amount shown before you pay.',
  'MyFNG may update wallet terms with in-app notice.',
];

export async function fetchWalletVehicleBlocked(
  apiFetchFn: (path: string) => Promise<any>,
  vehicleNumber?: string | null,
): Promise<{ blocked: boolean; reason?: string | null }> {
  const plate = String(vehicleNumber || '').trim();
  if (!plate) return { blocked: false, reason: null };
  try {
    const data = await apiFetchFn(
      `/api/customer/wallet/quote?vehicle_number=${encodeURIComponent(plate)}`,
    );
    return { blocked: Boolean(data?.wallet_blocked), reason: data?.block_reason || null };
  } catch {
    return { blocked: false, reason: null };
  }
}
