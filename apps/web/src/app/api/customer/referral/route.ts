import { NextRequest, NextResponse } from 'next/server';
import { ensureWalletAccount, logCustomerEvent, requireCustomer } from '@/lib/customer-api';
import { getWalletConfig } from '@/lib/wallet-config';

function makeCode(phone: string) {
  const suffix = phone.slice(-4);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MYF${suffix}${rand}`;
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  let { data: codeRow } = await supabaseAdmin
    .from('referral_codes')
    .select('*')
    .eq('customer_id', customer.id)
    .maybeSingle();

  if (!codeRow) {
    const generated = makeCode(customer.phone);
    const { data } = await supabaseAdmin
      .from('referral_codes')
      .insert({ customer_id: customer.id, code: generated, active: true })
      .select('*')
      .single();
    codeRow = data;
  }

  const { data: events } = await supabaseAdmin
    .from('referral_events')
    .select('*, referee:referee_customer_id(id, full_name, phone)')
    .eq('referrer_customer_id', customer.id)
    .order('created_at', { ascending: false });

  const { data: rewards } = await supabaseAdmin
    .from('referral_rewards')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false });

  const { count: totalReferred } = await supabaseAdmin
    .from('referral_events')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_customer_id', customer.id);

  const { count: totalRewarded } = await supabaseAdmin
    .from('referral_events')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_customer_id', customer.id)
    .eq('status', 'REWARDED');

  const totalEarned = (rewards || [])
    .filter((r: any) => r.status === 'CREDITED')
    .reduce((sum: number, r: any) => sum + Number(r.reward_amount || 0), 0);

  const { count: totalInvitesSent } = await supabaseAdmin
    .from('customer_analytics_events')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customer.id)
    .eq('event_name', 'referral_invite_sent');

  const { data: appliedAsReferee } = await supabaseAdmin
    .from('referral_events')
    .select('id, referral_code, status, created_at')
    .eq('referee_customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const referredCount = totalReferred || 0;
  const rewardedCount = totalRewarded || 0;

  // Fetch milestone claims (picks)
  let picks: Record<number, string> = {};
  const { data: claimsData } = await supabaseAdmin
    .from('referral_milestone_claims')
    .select('milestone_count, chosen_family')
    .eq('customer_id', customer.id);

  if (claimsData && claimsData.length > 0) {
    picks = Object.fromEntries(
      claimsData.map((c: any) => [c.milestone_count, c.chosen_family]),
    );
  } else {
    // Fallback: check referral_rewards with milestone metadata
    const { data: fallbackClaims } = await supabaseAdmin
      .from('referral_rewards')
      .select('metadata')
      .eq('customer_id', customer.id)
      .eq('reward_type', 'MILESTONE_REWARD');

    if (fallbackClaims && fallbackClaims.length > 0) {
      for (const fc of fallbackClaims) {
        const meta = fc.metadata as any;
        if (meta?.milestone_count && meta?.family) {
          picks[meta.milestone_count] = meta.family;
        }
      }
    }
  }

  return NextResponse.json({
    code: codeRow,
    events: events || [],
    rewards: rewards || [],
    refer_and_rise: { picks },
    applied_as_referee: appliedAsReferee
      ? {
          referral_code: String(appliedAsReferee.referral_code || ''),
          status: String(appliedAsReferee.status || ''),
          created_at: appliedAsReferee.created_at || null,
        }
      : null,
    stats: {
      total_referred: referredCount,
      total_rewarded: rewardedCount,
      total_pending: Math.max(0, referredCount - rewardedCount),
      total_invites_sent: totalInvitesSent || 0,
      total_earned: totalEarned,
    },
  });
}

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));
  const referredCode = String(body.referral_code || '').trim().toUpperCase();

  if (!referredCode) {
    return NextResponse.json({ error: 'referral_code is required' }, { status: 400 });
  }

  const { data: refCode } = await supabaseAdmin
    .from('referral_codes')
    .select('*')
    .eq('code', referredCode)
    .eq('active', true)
    .maybeSingle();
  if (!refCode) return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
  if (refCode.customer_id === customer.id) {
    return NextResponse.json({ error: 'Self referral is not allowed' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('referral_events')
    .select('id')
    .eq('referee_customer_id', customer.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: 'Referral already used' }, { status: 400 });

  const antiFraudFlags: string[] = [];
  if (String(body.device_id || '').length > 0) {
    const { data: byDevice } = await supabaseAdmin
      .from('referral_events')
      .select('id')
      .contains('anti_fraud_flags', [`device:${String(body.device_id)}`])
      .limit(1);
    if (byDevice && byDevice.length > 0) antiFraudFlags.push('same_device_guard');
    antiFraudFlags.push(`device:${String(body.device_id)}`);
  }

  const { data: event, error } = await supabaseAdmin
    .from('referral_events')
    .insert({
      referrer_customer_id: refCode.customer_id,
      referee_customer_id: customer.id,
      referral_code: referredCode,
      status: antiFraudFlags.includes('same_device_guard') ? 'REJECTED' : 'PENDING',
      anti_fraud_flags: antiFraudFlags,
    })
    .select('*')
    .single();

  if (error || !event) return NextResponse.json({ error: 'Failed to apply referral' }, { status: 500 });

  if (event.status !== 'REJECTED') {
    const walletConfig = await getWalletConfig(supabaseAdmin);
    const friendBonus = walletConfig.REFERRAL_FRIEND_BONUS;
    const expiryDays = walletConfig.REFERRAL_EXPIRY_DAYS;

    if (friendBonus > 0) {
      const wallet = await ensureWalletAccount(supabaseAdmin, customer.id);
      const nextBalance = Number(wallet.current_balance || 0) + friendBonus;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      await supabaseAdmin.from('wallet_transactions').insert({
        wallet_account_id: wallet.id,
        customer_id: customer.id,
        transaction_type: 'CREDIT',
        amount: friendBonus,
        balance_after: nextBalance,
        source: 'REFERRAL_BONUS',
        source_ref_id: event.id,
        idempotency_key: `referral_friend:${event.id}`,
        metadata: { reason: 'referral_friend_bonus', expires_at: expiresAt.toISOString() },
        expires_at: expiresAt.toISOString(),
      });

      await supabaseAdmin.from('wallet_accounts').update({
        current_balance: nextBalance,
        lifetime_credited: Number(wallet.lifetime_credited || 0) + friendBonus,
        updated_at: new Date().toISOString(),
      }).eq('id', wallet.id);
    }
  }

  await logCustomerEvent(supabaseAdmin, customer.id, 'referral_applied', 'referral', { referral_code: referredCode });

  if (event.status !== 'REJECTED') {
    try {
      const { notifyReferralFriendJoined } = await import('@/lib/referral-push-notify');
      await notifyReferralFriendJoined(supabaseAdmin, refCode.customer_id, {
        friendName: customer.full_name || customer.phone,
      });
    } catch (pushErr) {
      console.warn('[referral POST] friend_joined push failed:', pushErr);
    }
  }

  return NextResponse.json({ success: true, event });
}

// Reward referrer after friend's first completed booking
export async function PATCH(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));
  const eventId = String(body.referral_event_id || '');

  if (!eventId) {
    return NextResponse.json({ error: 'referral_event_id required' }, { status: 400 });
  }

  const { data: event } = await supabaseAdmin
    .from('referral_events')
    .select('*')
    .eq('id', eventId)
    .eq('referrer_customer_id', customer.id)
    .maybeSingle();
  if (!event || event.status === 'REWARDED') {
    return NextResponse.json({ error: 'Invalid referral event' }, { status: 400 });
  }

  const walletConfig = await getWalletConfig(supabaseAdmin);

  const { count: priorRewards } = await supabaseAdmin
    .from('referral_rewards')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customer.id)
    .eq('status', 'CREDITED');
  const isFirst = (priorRewards || 0) === 0;
  const rewardAmount = isFirst ? walletConfig.REFERRAL_FIRST_REWARD : walletConfig.REFERRAL_REPEAT_REWARD;

  if (rewardAmount <= 0) {
    return NextResponse.json({ error: 'Referral rewards are currently disabled' }, { status: 400 });
  }

  const wallet = await ensureWalletAccount(supabaseAdmin, customer.id);
  const nextBalance = Number(wallet.current_balance || 0) + rewardAmount;
  const idempotencyKey = `referral:${eventId}`;
  const expiryDays = walletConfig.REFERRAL_EXPIRY_DAYS;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  await supabaseAdmin.from('wallet_transactions').insert({
    wallet_account_id: wallet.id,
    customer_id: customer.id,
    transaction_type: 'CREDIT',
    amount: rewardAmount,
    balance_after: nextBalance,
    source: 'REFERRAL',
    source_ref_id: eventId,
    idempotency_key: idempotencyKey,
    metadata: { reason: 'refer_and_earn', is_first: isFirst, expires_at: expiresAt.toISOString() },
    expires_at: expiresAt.toISOString(),
  });
  await supabaseAdmin.from('wallet_accounts').update({
    current_balance: nextBalance,
    lifetime_credited: Number(wallet.lifetime_credited || 0) + rewardAmount,
    updated_at: new Date().toISOString(),
  }).eq('id', wallet.id);

  await supabaseAdmin.from('referral_events').update({ status: 'REWARDED', updated_at: new Date().toISOString() }).eq('id', eventId);
  await supabaseAdmin.from('referral_rewards').insert({
    referral_event_id: eventId,
    customer_id: customer.id,
    reward_type: 'WALLET_CREDIT',
    reward_amount: rewardAmount,
    status: 'CREDITED',
  });
  await logCustomerEvent(supabaseAdmin, customer.id, 'referral_reward_credited', 'referral', { rewardAmount, isFirst });

  try {
    const { notifyReferralMilestoneUnlocked } = await import('@/lib/referral-push-notify');
    await notifyReferralMilestoneUnlocked(supabaseAdmin, customer.id, {
      walletCreditAmount: rewardAmount,
    });
  } catch (pushErr) {
    console.warn('[referral PATCH] milestone push failed:', pushErr);
  }

  return NextResponse.json({ success: true, balance: nextBalance, reward_amount: rewardAmount });
}

