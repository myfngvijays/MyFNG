import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getWalletConfig } from '@/lib/wallet-config';
import { DEFAULT_REFER_AND_RISE_CONFIG, normalizeReferAndRiseConfig } from '@/lib/refer-and-rise';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    const config = await getWalletConfig(supabaseAdmin);

    const { data: riseRow } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'refer_and_rise_config')
      .maybeSingle();

    let referAndRiseConfig = DEFAULT_REFER_AND_RISE_CONFIG;
    if (riseRow?.setting_value) {
      try {
        referAndRiseConfig = normalizeReferAndRiseConfig(JSON.parse(riseRow.setting_value));
      } catch {
        referAndRiseConfig = DEFAULT_REFER_AND_RISE_CONFIG;
      }
    }

    const tnc = referAndRiseConfig.content?.tnc?.length
      ? referAndRiseConfig.content.tnc
      : DEFAULT_REFER_AND_RISE_CONFIG.content.tnc;

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
