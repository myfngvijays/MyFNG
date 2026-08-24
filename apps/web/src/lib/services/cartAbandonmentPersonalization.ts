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
      return `Account update: wallet balance ₹${walletBal} is available on your MyFNG account.`;
    }
    if (hasMembership) {
      return 'Account update: your MyFNG Prime membership is active on this account.';
    }
    return 'Your saved booking is still open on your account.';
  }

  if (walletBal >= 50) {
    return `Account reminder: wallet balance ₹${walletBal} remains on your MyFNG account.`;
  }
  if (hasMembership) {
    return 'Account reminder: your MyFNG Prime membership is still active.';
  }
  return 'Your booking draft is still incomplete on your account.';
}
