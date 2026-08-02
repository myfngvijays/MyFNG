export type CartAbandonmentStage = '3h' | '12h';

/** Personalized offer/urgency line from live wallet + membership data. */
export async function buildCartAbandonmentPersonalLine(
  supabaseAdmin: any,
  customerId: string,
  stage: CartAbandonmentStage,
): Promise<string> {
  const [walletRes, membershipRes] = await Promise.all([
    supabaseAdmin
      .from('wallet_accounts')
      .select('current_balance')
      .eq('customer_id', customerId)
      .maybeSingle(),
    supabaseAdmin
      .from('customer_memberships')
      .select('id, status, expires_at')
      .eq('customer_id', customerId)
      .eq('status', 'ACTIVE')
      .maybeSingle(),
  ]);

  const walletBal = Math.floor(Number(walletRes.data?.current_balance || 0));
  const hasMembership = Boolean(membershipRes.data);

  if (stage === '3h') {
    if (walletBal >= 50) {
      return `Use your wallet balance of ₹${walletBal} on this booking.`;
    }
    if (hasMembership) {
      return 'Prime member benefit: extra savings apply when you book on the app.';
    }
    return 'Book now on the app to unlock wallet rewards and live tracking.';
  }

  if (walletBal >= 50) {
    return `Last reminder — ₹${walletBal} wallet balance waiting. Slots fill fast.`;
  }
  if (hasMembership) {
    return 'Prime member: confirm today to keep your preferred pickup slot.';
  }
  return 'Limited pickup slots today — complete booking to avoid reschedule.';
}
