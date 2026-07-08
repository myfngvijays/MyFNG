import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer, ensureWalletAccount, logCustomerEvent } from '@/lib/customer-api';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

function parseWalletAmount(rewardText: string): number | null {
  const match = rewardText.match(/₹([\d,]+)/);
  if (!match) return null;
  return Number(match[1].replace(/,/g, ''));
}

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const body = await request.json().catch(() => ({}));
  const { referralCount, family } = body;

  if (!referralCount || !family) {
    return NextResponse.json({ error: 'referralCount and family are required' }, { status: 400 });
  }

  // Verify user has enough referrals
  const { count: totalRewarded } = await supabaseAdmin
    .from('referral_events')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_customer_id', customer.id)
    .eq('status', 'REWARDED');

  if ((totalRewarded || 0) < referralCount) {
    return NextResponse.json({ error: 'Not enough referrals for this milestone' }, { status: 400 });
  }

  // Check if already claimed this milestone
  const { data: existingClaim } = await supabaseAdmin
    .from('referral_milestone_claims')
    .select('id')
    .eq('customer_id', customer.id)
    .eq('milestone_count', referralCount)
    .maybeSingle();

  if (existingClaim) {
    return NextResponse.json({ error: 'Milestone already claimed' }, { status: 400 });
  }

  // Get config to find reward text
  const { data: configRow } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'refer_and_rise_config')
    .maybeSingle();

  let rewardText = '';
  if (configRow?.setting_value) {
    try {
      const config = JSON.parse(configRow.setting_value);
      const milestone = (config.milestones || []).find((m: any) => m.referralCount === referralCount);
      if (milestone && milestone.rewards[family]) {
        rewardText = milestone.rewards[family];
      }
    } catch {}
  }

  // Record the claim
  const { data: claim, error: claimError } = await supabaseAdmin
    .from('referral_milestone_claims')
    .insert({
      customer_id: customer.id,
      milestone_count: referralCount,
      chosen_family: family,
      reward_text: rewardText,
      status: 'CLAIMED',
      claimed_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (claimError) {
    // Table might not exist yet - create it inline or just log as referral_reward
    const { error: fallbackError } = await supabaseAdmin
      .from('referral_rewards')
      .insert({
        customer_id: customer.id,
        reward_type: 'MILESTONE_REWARD',
        reward_amount: 0,
        status: 'CLAIMED',
        metadata: { milestone_count: referralCount, family, reward_text: rewardText },
      });

    if (fallbackError) {
      return NextResponse.json({ error: 'Failed to record claim' }, { status: 500 });
    }
  }

  // If it's a wallet credit reward, auto-add to wallet
  const walletAmount = parseWalletAmount(rewardText);
  if (walletAmount && walletAmount > 0) {
    try {
      const wallet = await ensureWalletAccount(supabaseAdmin, customer.id);
      const nextBalance = Number(wallet.current_balance || 0) + walletAmount;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      await supabaseAdmin.from('wallet_transactions').insert({
        wallet_account_id: wallet.id,
        customer_id: customer.id,
        transaction_type: 'CREDIT',
        amount: walletAmount,
        balance_after: nextBalance,
        source: 'REFERRAL_MILESTONE',
        source_ref_id: claim?.id || `milestone_${referralCount}_${family}`,
        idempotency_key: `rise_milestone:${customer.id}:${referralCount}`,
        metadata: {
          reason: 'refer_and_rise_milestone',
          milestone_count: referralCount,
          family,
          reward_text: rewardText,
          expires_at: expiresAt.toISOString(),
        },
        expires_at: expiresAt.toISOString(),
      });

      await supabaseAdmin.from('wallet_accounts').update({
        current_balance: nextBalance,
        lifetime_credited: Number(wallet.lifetime_credited || 0) + walletAmount,
        updated_at: new Date().toISOString(),
      }).eq('id', wallet.id);

      await logCustomerEvent(supabaseAdmin, customer.id, 'milestone_wallet_credit', 'referral', {
        milestone_count: referralCount,
        family,
        amount: walletAmount,
      });

      return NextResponse.json({
        success: true,
        reward_type: 'wallet_credit',
        wallet_amount: walletAmount,
        new_balance: nextBalance,
        reward_text: rewardText,
      });
    } catch (e: any) {
      // Wallet credit failed but claim recorded
    }
  }

  // Non-wallet reward (benefit/service) - just log
  await logCustomerEvent(supabaseAdmin, customer.id, 'milestone_reward_claimed', 'referral', {
    milestone_count: referralCount,
    family,
    reward_text: rewardText,
  });

  return NextResponse.json({
    success: true,
    reward_type: 'benefit',
    reward_text: rewardText,
  });
}
