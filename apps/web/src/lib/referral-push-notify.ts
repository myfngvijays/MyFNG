import 'server-only';
import {
  DEFAULT_REFER_AND_RISE_CONFIG,
  getReferPushTemplate,
  normalizeReferAndRiseConfig,
  type ReferPushTrigger,
} from '@/lib/refer-and-rise';
import { dispatchPushToCustomer } from '@/lib/push/dispatchCustomerPush';

function formatInr(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatFriendName(name: string | null | undefined): string {
  const trimmed = String(name || '').trim();
  return trimmed || 'Your friend';
}

function applyPushTemplate(template: string, vars: Record<string, string>): string {
  return String(template || '')
    .replace(/\{\{FRIEND_NAME\}\}/g, vars.FRIEND_NAME || 'Your friend')
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

async function sendReferPush(
  supabaseAdmin: any,
  referrerCustomerId: string,
  trigger: ReferPushTrigger,
  vars: Record<string, string>,
): Promise<{ sent: boolean; delivered?: number }> {
  const customerId = String(referrerCustomerId || '').trim();
  if (!customerId) return { sent: false };

  const config = await loadReferAndRiseConfig(supabaseAdmin);
  const template = getReferPushTemplate(config.content, trigger);
  if (!template.enabled) return { sent: false };

  const title = String(template.title || '').trim();
  const bodyTemplate = String(template.body || '').trim();
  if (!title || !bodyTemplate) return { sent: false };

  const body = applyPushTemplate(bodyTemplate, vars);
  const notificationType = trigger === 'milestone_unlocked' ? 'REFERRAL_MILESTONE' : 'REFERRAL_UPDATE';

  const result = await dispatchPushToCustomer(
    customerId,
    {
      title,
      body,
      notificationType,
      data: {
        screen: 'Refer & Rise',
        sub_page: 'Refer & Rise',
        referral_trigger: trigger,
        ...(vars.MILESTONE ? { milestone_count: vars.MILESTONE } : {}),
      },
    },
    'referral_updates',
  );

  return { sent: result.delivered > 0, delivered: result.delivered };
}

/**
 * Notify referrer when a referred friend applies their code (install/signup).
 */
export async function notifyReferralFriendJoined(
  supabaseAdmin: any,
  referrerCustomerId: string,
  opts?: { friendName?: string | null },
): Promise<{ sent: boolean; delivered?: number }> {
  return sendReferPush(supabaseAdmin, referrerCustomerId, 'friend_joined', {
    FRIEND_NAME: formatFriendName(opts?.friendName),
  });
}

/**
 * Notify referrer when a referred friend books their first service.
 * Idempotent: only sends once per referral event (uses first_order_lead_id).
 */
export async function notifyReferrerOnRefereeBooking(
  supabaseAdmin: any,
  refereeCustomerId: string,
  leadId: string,
): Promise<{ sent: boolean; delivered?: number; skipped?: string }> {
  const customerId = String(refereeCustomerId || '').trim();
  const serviceLeadId = String(leadId || '').trim();
  if (!customerId || !serviceLeadId) return { sent: false, skipped: 'missing_ids' };

  const { data: referralEvent } = await supabaseAdmin
    .from('referral_events')
    .select('id, referrer_customer_id, first_order_lead_id, status, referee:referee_customer_id(full_name, phone)')
    .eq('referee_customer_id', customerId)
    .in('status', ['PENDING', 'QUALIFIED'])
    .maybeSingle();

  if (!referralEvent) return { sent: false, skipped: 'no_pending_referral' };
  if (referralEvent.first_order_lead_id) return { sent: false, skipped: 'already_booked' };

  await supabaseAdmin
    .from('referral_events')
    .update({
      first_order_lead_id: serviceLeadId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', referralEvent.id);

  const referee = referralEvent.referee as { full_name?: string | null; phone?: string | null } | null;
  const friendName = formatFriendName(referee?.full_name || referee?.phone);

  return sendReferPush(supabaseAdmin, referralEvent.referrer_customer_id, 'friend_booked', {
    FRIEND_NAME: friendName,
  });
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
