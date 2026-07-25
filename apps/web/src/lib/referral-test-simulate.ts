import { ensureWalletAccount } from '@/lib/customer-api';
import { getWalletConfig } from '@/lib/wallet-config';
import { normalizePhoneLast10 } from '@/lib/refer-and-rise';

function buildSyntheticRefereePhone(seed?: string): string {
  const suffix = String(Date.now()).slice(-7);
  const rand = String(Math.floor(Math.random() * 90 + 10));
  const fromSeed = seed ? normalizePhoneLast10(seed) : '';
  if (fromSeed.length === 10) {
    return fromSeed;
  }
  return `90${suffix}${rand}`.slice(0, 10);
}

async function createDummyReferee(
  supabaseAdmin: any,
  opts: { friendName?: string; friendPhone?: string; referrerCustomerId: string; referrerPhone?: string },
): Promise<{ id: string; phone: string; full_name: string | null }> {
  const referrerPhone = normalizePhoneLast10(opts.referrerPhone || '');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const phone = buildSyntheticRefereePhone(
      attempt === 0 ? opts.friendPhone : `${Date.now()}${attempt}`,
    );

    if (referrerPhone && phone === referrerPhone) continue;

    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('id, phone, full_name')
      .eq('phone', phone)
      .maybeSingle();

    if (existing?.id) {
      if (existing.id === opts.referrerCustomerId) continue;
      const { data: usedReferral } = await supabaseAdmin
        .from('referral_events')
        .select('id')
        .eq('referee_customer_id', existing.id)
        .maybeSingle();
      if (!usedReferral) {
        return existing;
      }
      continue;
    }

    const { data: created, error } = await supabaseAdmin
      .from('customers')
      .insert({
        phone,
        full_name: opts.friendName?.trim() || 'Test Friend',
        phone_verified: false,
        is_active: true,
      })
      .select('id, phone, full_name')
      .single();

    if (!error && created?.id) {
      return created;
    }
  }

  throw new Error('Could not create test referee customer');
}

export async function rewardReferralEvent(
  supabaseAdmin: any,
  eventId: string,
  opts?: { manual?: boolean; rewardedBy?: string },
): Promise<{ rewardAmount: number; referrerCustomerId: string }> {
  const { data: referralEvent } = await supabaseAdmin
    .from('referral_events')
    .select('id, referrer_customer_id, referee_customer_id, status')
    .eq('id', eventId)
    .maybeSingle();

  if (!referralEvent) {
    throw new Error('Referral event not found');
  }
  if (referralEvent.status === 'REWARDED') {
    return { rewardAmount: 0, referrerCustomerId: referralEvent.referrer_customer_id };
  }

  const walletConfig = await getWalletConfig(supabaseAdmin);
  const { count: priorRewards } = await supabaseAdmin
    .from('referral_rewards')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', referralEvent.referrer_customer_id)
    .eq('status', 'CREDITED');

  const isFirst = (priorRewards || 0) === 0;
  const rewardAmount = isFirst ? walletConfig.REFERRAL_FIRST_REWARD : walletConfig.REFERRAL_REPEAT_REWARD;

  if (rewardAmount <= 0) {
    await supabaseAdmin
      .from('referral_events')
      .update({ status: 'REWARDED', updated_at: new Date().toISOString() })
      .eq('id', eventId);
    try {
      const { notifyReferralMilestoneUnlocked } = await import('@/lib/referral-push-notify');
      await notifyReferralMilestoneUnlocked(supabaseAdmin, referralEvent.referrer_customer_id);
    } catch (pushErr) {
      console.warn('[referral reward] milestone push failed:', pushErr);
    }
    return { rewardAmount: 0, referrerCustomerId: referralEvent.referrer_customer_id };
  }

  const wallet = await ensureWalletAccount(supabaseAdmin, referralEvent.referrer_customer_id);
  const { data: walletRow } = await supabaseAdmin
    .from('wallet_accounts')
    .select('id, current_balance, lifetime_credited')
    .eq('id', wallet.id)
    .single();
  const currentBalance = Number(walletRow?.current_balance || 0);
  const lifetimeCredited = Number(walletRow?.lifetime_credited || 0);
  const nextBalance = currentBalance + rewardAmount;
  const expiryDays = walletConfig.REFERRAL_EXPIRY_DAYS || 90;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);
  const idempotencyKey = `referral:${eventId}`;

  const { data: existingTx } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (!existingTx) {
    await supabaseAdmin.from('wallet_transactions').insert({
      wallet_account_id: wallet.id,
      customer_id: referralEvent.referrer_customer_id,
      transaction_type: 'CREDIT',
      amount: rewardAmount,
      balance_after: nextBalance,
      source: 'REFERRAL',
      source_ref_id: eventId,
      idempotency_key: idempotencyKey,
      metadata: {
        reason: 'refer_and_earn',
        is_first: isFirst,
        referee_customer_id: referralEvent.referee_customer_id,
        expires_at: expiresAt.toISOString(),
        test_simulate: Boolean(opts?.manual),
        rewarded_by: opts?.rewardedBy || null,
      },
      expires_at: expiresAt.toISOString(),
    });

    await supabaseAdmin
      .from('wallet_accounts')
      .update({
        current_balance: nextBalance,
        lifetime_credited: lifetimeCredited + rewardAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);
  }

  await supabaseAdmin
    .from('referral_events')
    .update({ status: 'REWARDED', updated_at: new Date().toISOString() })
    .eq('id', eventId);

  await supabaseAdmin.from('referral_rewards').insert({
    referral_event_id: eventId,
    customer_id: referralEvent.referrer_customer_id,
    reward_type: 'WALLET_CREDIT',
    reward_amount: rewardAmount,
    status: 'CREDITED',
  });

  try {
    const { notifyReferralMilestoneUnlocked } = await import('@/lib/referral-push-notify');
    await notifyReferralMilestoneUnlocked(supabaseAdmin, referralEvent.referrer_customer_id, {
      walletCreditAmount: rewardAmount,
    });
  } catch (pushErr) {
    console.warn('[referral reward] milestone push failed:', pushErr);
  }

  return { rewardAmount, referrerCustomerId: referralEvent.referrer_customer_id };
}

export async function simulateReferralInvite(
  supabaseAdmin: any,
  opts: {
    referrerCustomerId: string;
    referralCode: string;
    friendName?: string;
    friendPhone?: string;
    referrerPhone?: string;
  },
) {
  const referee = await createDummyReferee(supabaseAdmin, {
    friendName: opts.friendName,
    friendPhone: opts.friendPhone,
    referrerCustomerId: opts.referrerCustomerId,
    referrerPhone: opts.referrerPhone,
  });

  const { data: event, error } = await supabaseAdmin
    .from('referral_events')
    .insert({
      referrer_customer_id: opts.referrerCustomerId,
      referee_customer_id: referee.id,
      referral_code: opts.referralCode,
      status: 'PENDING',
      anti_fraud_flags: ['test_simulate'],
    })
    .select('*')
    .single();

  if (error || !event) {
    throw new Error(error?.message || 'Failed to create test referral event');
  }

  const reward = await rewardReferralEvent(supabaseAdmin, event.id, { manual: true });

  const { count: totalRewarded } = await supabaseAdmin
    .from('referral_events')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_customer_id', opts.referrerCustomerId)
    .eq('status', 'REWARDED');

  return {
    event,
    referee,
    reward_amount: reward.rewardAmount,
    stats: {
      total_rewarded: totalRewarded || 0,
    },
  };
}
