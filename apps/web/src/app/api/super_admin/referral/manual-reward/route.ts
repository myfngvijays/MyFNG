import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getWalletConfig } from '@/lib/wallet-config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/super_admin/referral/manual-reward
 * Manually mark a referral event as REWARDED and credit the referrer's wallet.
 * Skips the paid-invoice/completed-lead check — admin override.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userData as any)?.roles?.role_code;
    if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const eventId = String(body?.event_id || '').trim();
    if (!eventId) {
      return NextResponse.json({ error: 'event_id is required' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 });
    }

    const { data: referralEvent } = await supabaseAdmin
      .from('referral_events')
      .select('id, referrer_customer_id, referee_customer_id, status')
      .eq('id', eventId)
      .maybeSingle();

    if (!referralEvent) {
      return NextResponse.json({ error: 'Referral event not found' }, { status: 404 });
    }

    if (referralEvent.status === 'REWARDED') {
      return NextResponse.json({ error: 'Already rewarded', status: referralEvent.status }, { status: 400 });
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
      await supabaseAdmin.from('referral_events').update({
        status: 'REWARDED',
        updated_at: new Date().toISOString(),
      }).eq('id', eventId);
      return NextResponse.json({ success: true, rewarded: true, amount: 0, message: 'Marked as rewarded (reward amount is 0)' });
    }

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
      if (!newWallet) {
        return NextResponse.json({ error: 'Failed to create wallet' }, { status: 500 });
      }
      walletId = newWallet.id;
      currentBalance = 0;
      lifetimeCredited = 0;
    }

    const nextBalance = currentBalance + rewardAmount;
    const expiryDays = walletConfig.REFERRAL_EXPIRY_DAYS || 90;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);
    const idempotencyKey = `referral:${referralEvent.id}`;

    const { data: existingTx } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (!existingTx) {
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
          referee_customer_id: referralEvent.referee_customer_id,
          expires_at: expiresAt.toISOString(),
          manual_reward: true,
          rewarded_by: user.id,
        },
        expires_at: expiresAt.toISOString(),
      });

      await supabaseAdmin.from('wallet_accounts').update({
        current_balance: nextBalance,
        lifetime_credited: lifetimeCredited + rewardAmount,
        updated_at: new Date().toISOString(),
      }).eq('id', walletId);
    }

    await supabaseAdmin.from('referral_events').update({
      status: 'REWARDED',
      updated_at: new Date().toISOString(),
    }).eq('id', referralEvent.id);

    await supabaseAdmin.from('referral_rewards').insert({
      referral_event_id: referralEvent.id,
      customer_id: referralEvent.referrer_customer_id,
      reward_type: 'WALLET_CREDIT',
      reward_amount: rewardAmount,
      status: 'CREDITED',
    });

    return NextResponse.json({
      success: true,
      rewarded: true,
      amount: rewardAmount,
      referrer_customer_id: referralEvent.referrer_customer_id,
      new_balance: nextBalance,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
