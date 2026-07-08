import { getWalletConfig } from '@/lib/wallet-config';

/**
 * Reward referrer when their referred friend's first service is completed.
 * Triggered on: payment confirmation, delivery completion, or lead status change to COMPLETED/DELIVERED.
 */
export async function maybeRewardReferrer(
  supabaseAdmin: any,
  customerId: string,
): Promise<void> {
  // Check if this customer was referred (has a PENDING referral event as referee)
  const { data: referralEvent } = await supabaseAdmin
    .from('referral_events')
    .select('id, referrer_customer_id, status')
    .eq('referee_customer_id', customerId)
    .eq('status', 'PENDING')
    .maybeSingle();

  if (!referralEvent) return;

  // Check eligibility: first completed/paid service
  const { count: paidInvoices } = await supabaseAdmin
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('payment_status', 'PAID');

  const { count: completedLeads } = await supabaseAdmin
    .from('service_leads')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .in('status', ['COMPLETED', 'DELIVERED', 'PAID', 'CLOSED']);

  const hasCompletedService = (paidInvoices && paidInvoices >= 1) || (completedLeads && completedLeads >= 1);
  if (!hasCompletedService) return;

  const walletConfig = await getWalletConfig(supabaseAdmin);

  // Determine reward amount (first vs repeat)
  const { count: priorRewards } = await supabaseAdmin
    .from('referral_rewards')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', referralEvent.referrer_customer_id)
    .eq('status', 'CREDITED');

  const isFirst = (priorRewards || 0) === 0;
  const rewardAmount = isFirst ? walletConfig.REFERRAL_FIRST_REWARD : walletConfig.REFERRAL_REPEAT_REWARD;

  if (rewardAmount <= 0) return;

  // Credit referrer's wallet
  const { data: wallet } = await supabaseAdmin
    .from('wallet_accounts')
    .select('id, current_balance, lifetime_credited')
    .eq('customer_id', referralEvent.referrer_customer_id)
    .maybeSingle();

  let walletId: string;
  let currentBalance: number;
  let lifetimeCredited: number;

  if (wallet) {
    walletId = wallet.id;
    currentBalance = Number(wallet.current_balance || 0);
    lifetimeCredited = Number(wallet.lifetime_credited || 0);
  } else {
    const { data: newWallet } = await supabaseAdmin
      .from('wallet_accounts')
      .insert({ customer_id: referralEvent.referrer_customer_id, current_balance: 0 })
      .select('id, current_balance, lifetime_credited')
      .single();
    if (!newWallet) return;
    walletId = newWallet.id;
    currentBalance = 0;
    lifetimeCredited = 0;
  }

  const nextBalance = currentBalance + rewardAmount;
  const expiryDays = walletConfig.REFERRAL_EXPIRY_DAYS || 90;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);
  const idempotencyKey = `referral:${referralEvent.id}`;

  // Check idempotency
  const { data: existingTx } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existingTx) return;

  await supabaseAdmin.from('wallet_transactions').insert({
    wallet_account_id: walletId,
    customer_id: referralEvent.referrer_customer_id,
    transaction_type: 'CREDIT',
    amount: rewardAmount,
    balance_after: nextBalance,
    source: 'REFERRAL',
    source_ref_id: referralEvent.id,
    idempotency_key: idempotencyKey,
    metadata: {
      reason: 'refer_and_earn',
      is_first: isFirst,
      referee_customer_id: customerId,
      expires_at: expiresAt.toISOString(),
    },
    expires_at: expiresAt.toISOString(),
  });

  await supabaseAdmin.from('wallet_accounts').update({
    current_balance: nextBalance,
    lifetime_credited: lifetimeCredited + rewardAmount,
    updated_at: new Date().toISOString(),
  }).eq('id', walletId);

  // Mark referral event as REWARDED
  await supabaseAdmin.from('referral_events').update({
    status: 'REWARDED',
    updated_at: new Date().toISOString(),
  }).eq('id', referralEvent.id);

  // Record in referral_rewards
  await supabaseAdmin.from('referral_rewards').insert({
    referral_event_id: referralEvent.id,
    customer_id: referralEvent.referrer_customer_id,
    reward_type: 'WALLET_CREDIT',
    reward_amount: rewardAmount,
    status: 'CREDITED',
  });
}
