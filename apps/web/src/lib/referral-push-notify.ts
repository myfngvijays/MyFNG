import 'server-only';
import {
  DEFAULT_REFER_AND_RISE_CONFIG,
  getReferPushTemplate,
  normalizeReferAndRiseConfig,
} from '@/lib/refer-and-rise';
import { dispatchPushToCustomer } from '@/lib/push/dispatchCustomerPush';

function formatInr(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return `₹${n.toLocaleString('en-IN')}`;
}

function applyPushTemplate(template: string, vars: Record<string, string>): string {
  return String(template || '')
    .replace(/\{\{WALLET_PART\}\}/g, vars.WALLET_PART || '')
    .replace(/\{\{MILESTONE\}\}/g, vars.MILESTONE || '')
    .replace(/\{\{WALLET_AMOUNT\}\}/g, vars.WALLET_AMOUNT || '');
}

async function loadReferAndRiseConfig(supabaseAdmin: any) {
  const { data: configRow } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'refer_and_rise_config')
    .maybeSingle();

  if (!configRow?.setting_value) return DEFAULT_REFER_AND_RISE_CONFIG;

  try {
    return normalizeReferAndRiseConfig(JSON.parse(configRow.setting_value));
  } catch {
    return DEFAULT_REFER_AND_RISE_CONFIG;
  }
}

/**
 * Notify referrer when a new Refer & Rise milestone becomes claimable
 * (after a referred friend's booking is rewarded).
 */
export async function notifyReferralMilestoneUnlocked(
  supabaseAdmin: any,
  referrerCustomerId: string,
  opts?: { walletCreditAmount?: number },
): Promise<{ sent: boolean; milestoneCount?: number; delivered?: number }> {
  const customerId = String(referrerCustomerId || '').trim();
  if (!customerId) return { sent: false };

  const { count: totalRewarded } = await supabaseAdmin
    .from('referral_events')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_customer_id', customerId)
    .eq('status', 'REWARDED');

  const rewardedCount = totalRewarded || 0;
  if (rewardedCount <= 0) return { sent: false };

  const config = await loadReferAndRiseConfig(supabaseAdmin);
  const milestone = config.milestones.find((m) => m.referralCount === rewardedCount);
  if (!milestone) return { sent: false };

  const { data: claims } = await supabaseAdmin
    .from('referral_milestone_claims')
    .select('milestone_count')
    .eq('customer_id', customerId)
    .eq('milestone_count', milestone.referralCount)
    .limit(1);

  if (claims?.length) return { sent: false };

  const walletAmount = Number(opts?.walletCreditAmount || 0);
  const walletPart =
    walletAmount > 0 ? `${formatInr(walletAmount)} wallet bonus credited. ` : '';

  const template = getReferPushTemplate(config.content, 'milestone_unlocked');
  if (!template.enabled) return { sent: false, milestoneCount: milestone.referralCount };

  const title = String(template.title || '').trim();
  const bodyTemplate = String(template.body || '').trim();
  if (!title || !bodyTemplate) return { sent: false, milestoneCount: milestone.referralCount };

  const body = applyPushTemplate(bodyTemplate, {
    WALLET_PART: walletPart,
    MILESTONE: String(milestone.referralCount),
    WALLET_AMOUNT: walletAmount > 0 ? formatInr(walletAmount) : '',
  });

  const result = await dispatchPushToCustomer(
    customerId,
    {
      title,
      body,
      notificationType: 'REFERRAL_MILESTONE',
      data: {
        screen: 'Refer & Rise',
        sub_page: 'Refer & Rise',
        milestone_count: String(milestone.referralCount),
      },
    },
    'referral_updates',
  );

  return {
    sent: result.delivered > 0,
    milestoneCount: milestone.referralCount,
    delivered: result.delivered,
  };
}
