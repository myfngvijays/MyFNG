import { apiFetch } from './api';

export function membershipAmountFromOrder(orderRes: {
  amount_paise?: number | null;
  amount?: number | null;
} | null | undefined): number | undefined {
  const paise = Number(orderRes?.amount_paise || 0);
  if (paise > 0) return Math.round(paise / 100);
  const amount = Number(orderRes?.amount || 0);
  return amount > 0 ? amount : undefined;
}

export async function notifyMembershipPaymentFailedOnServer(input: {
  planId?: string | null;
  planName?: string | null;
  amountPaid?: number | null;
  reason?: string | null;
}): Promise<void> {
  try {
    await apiFetch('/api/customer/membership/payment-failed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: input.planId || undefined,
        plan_name: input.planName || undefined,
        amount_paid: input.amountPaid || undefined,
        reason: input.reason || 'failed',
      }),
    });
  } catch {
    // Non-blocking notification.
  }
}

export async function notifyAppSessionIncompleteOnServer(durationSec: number): Promise<void> {
  try {
    await apiFetch('/api/customer/app-session/incomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_duration_sec: durationSec }),
    });
  } catch {
    // Non-blocking notification.
  }
}
