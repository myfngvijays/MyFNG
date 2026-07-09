import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getWalletConfig } from '@/lib/wallet-config';

export const dynamic = 'force-dynamic';

const DEFAULT_TNC = [
  'First successful referral gives you \u20b9500 reward.',
  'Every next referral gives you \u20b9250 reward.',
  'Your referral reward unlocks when your friend books their first service.',
  'Your friend gets \u20b91,500 wallet balance (\u20b91,000 welcome + \u20b9500 referral bonus) instantly on signup.',
  'Wallet balance expires in 90 days.',
  'Maximum wallet usage: 10% of service booking amount.',
  'Rewards cannot be converted to cash.',
  'Self-referral and fraudulent referrals will be rejected.',
];

export async function GET() {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    const config = await getWalletConfig(supabaseAdmin);

    const { data: tncRow } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'referral_tnc')
      .maybeSingle();

    let tnc = DEFAULT_TNC;
    if (tncRow?.setting_value) {
      try { tnc = JSON.parse(tncRow.setting_value); } catch {}
    }

    const { data: riseRow } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'refer_and_rise_config')
      .maybeSingle();

    let referAndRiseConfig = null;
    if (riseRow?.setting_value) {
      try { referAndRiseConfig = JSON.parse(riseRow.setting_value); } catch {}
    }

    return NextResponse.json({
      success: true,
      referral_first_reward: config.REFERRAL_FIRST_REWARD,
      referral_repeat_reward: config.REFERRAL_REPEAT_REWARD,
      referral_friend_bonus: config.REFERRAL_FRIEND_BONUS,
      referral_expiry_days: config.REFERRAL_EXPIRY_DAYS,
      welcome_bonus: config.WELCOME_BONUS_AMOUNT,
      total_friend_bonus: config.REFERRAL_FRIEND_BONUS + config.WELCOME_BONUS_AMOUNT,
      tnc,
      refer_and_rise_config: referAndRiseConfig,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
