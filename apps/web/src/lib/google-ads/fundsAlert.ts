import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendTextMessage } from '@/lib/services/whatsappService';
import { getEnabledSystemAlertWhatsAppNumbers } from '@/lib/services/systemAlertWhatsAppNumbers';
import {
  buildGoogleAdsFundsTemplateParams,
  getGoogleAdsFundsAlertTemplateStatus,
  sendGoogleAdsFundsAlertTemplateMessage,
} from '@/lib/services/googleAdsFundsAlertTemplate';
import { getFundsTracker } from './tools';

const THRESHOLD_KEY = 'google_ads_funds_alert_threshold';
const ENABLED_KEY = 'google_ads_funds_alert_enabled';
const LAST_SENT_KEY = 'google_ads_funds_alert_last_sent_at';
const LAST_REMAINING_KEY = 'google_ads_funds_alert_last_remaining';
const LAST_CHECKED_KEY = 'google_ads_funds_alert_last_checked_at';
const DEFAULT_THRESHOLD = 1000;
const COOLDOWN_MS = 12 * 60 * 60 * 1000;
const RECOVER_BUFFER = 500;

function inr(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
}

async function readSetting(key: string): Promise<string> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return '';
  const { data } = await supabaseAdmin.from('system_settings').select('setting_value').eq('setting_key', key).maybeSingle();
  return data?.setting_value != null ? String(data.setting_value) : '';
}

async function writeSetting(key: string, value: string, description: string) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: key,
      setting_value: value,
      setting_type: 'STRING',
      category: 'GOOGLE_ADS',
      description,
      default_value: '',
      is_editable: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
}

export function fundsAmount(funds: any): number | null {
  if (funds?.funds_from_api && funds.remaining != null) return Number(funds.remaining);
  if (funds?.remaining != null && !funds?.infinite) return Number(funds.remaining);
  return null;
}

export async function getGoogleAdsFundsAlertSnapshot() {
  const threshold = Number(await readSetting(THRESHOLD_KEY)) || DEFAULT_THRESHOLD;
  const enabled = (await readSetting(ENABLED_KEY)) !== 'false';
  const lastSentAt = (await readSetting(LAST_SENT_KEY)) || null;
  const lastCheckedAt = (await readSetting(LAST_CHECKED_KEY)) || null;
  const lastRemainingRaw = await readSetting(LAST_REMAINING_KEY);
  const lastRemaining = lastRemainingRaw.trim() === '' ? null : Number(lastRemainingRaw);
  const template = await getGoogleAdsFundsAlertTemplateStatus();
  return {
    threshold,
    enabled,
    last_sent_at: lastSentAt || null,
    last_checked_at: lastCheckedAt || null,
    last_remaining: Number.isFinite(lastRemaining as number) ? lastRemaining : null,
    template,
  };
}

function buildMessage(funds: any, threshold: number, test?: boolean) {
  const remaining = fundsAmount(funds);
  return [
    test ? 'TEST · MyFNG Google Ads funds' : 'ALERT · MyFNG Google Ads funds low',
    remaining != null ? `Remaining: ${inr(remaining)} (limit ${inr(threshold)})` : `Remaining: Invoice account — API nahi dikhata`,
    `Daily budget: ${inr(funds?.daily_budget || 0)} · Today: ${inr(funds?.today_spend || 0)}`,
    `7d burn: ${inr(funds?.daily_burn || 0)}/day`,
    `${funds?.account?.name || 'Google Ads'} · ${funds?.account?.id || ''}`,
    funds?.funding ? `Pay: ${funds.funding}` : '',
    'Google Ads → Billing & payments mein top-up karo.',
  ]
    .filter(Boolean)
    .join('\n');
}

function templateParams(funds: any, threshold: number, test?: boolean) {
  const remaining = fundsAmount(funds);
  return buildGoogleAdsFundsTemplateParams({
    timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    status: test ? 'GOOGLE ADS FUNDS TEST' : 'GOOGLE ADS FUNDS LOW',
    remainingInr: remaining == null ? 'NA' : String(Math.round(remaining)),
    thresholdInr: String(Math.round(threshold)),
    details: `Daily budget INR ${Math.round(Number(funds?.daily_budget || 0))}. Top up in Google Ads Billing and payments.`,
  });
}

async function sendFundsAlertToNumber(
  phone: string,
  funds: any,
  threshold: number,
  options?: { test?: boolean; canSendTemplate?: boolean },
) {
  if (options?.canSendTemplate) {
    const result = await sendGoogleAdsFundsAlertTemplateMessage(phone, templateParams(funds, threshold, options.test));
    if (result.success) return { ...result, deliveryMode: 'template' as const };
  }
  const result = await sendTextMessage(phone, buildMessage(funds, threshold, options?.test));
  return {
    success: result.success,
    error: result.success
      ? undefined
      : result.error ||
        'Text failed. Create and approve google_ads_funds_alert on WhatsApp Cron for 24/7 alerts.',
    messageId: result.messageId,
    deliveryMode: 'text' as const,
  };
}

export async function runGoogleAdsFundsAlert(options?: { test?: boolean; force?: boolean }) {
  const threshold = Number(await readSetting(THRESHOLD_KEY)) || DEFAULT_THRESHOLD;
  const enabled = (await readSetting(ENABLED_KEY)) !== 'false';
  const lastSentAt = await readSetting(LAST_SENT_KEY);
  const numbers = await getEnabledSystemAlertWhatsAppNumbers();
  const funds = await getFundsTracker();
  const remaining = fundsAmount(funds);
  const now = new Date().toISOString();
  await writeSetting(LAST_CHECKED_KEY, now, 'Last Google Ads funds cron check');
  if (remaining != null) {
    await writeSetting(LAST_REMAINING_KEY, String(remaining), 'Last seen Google Ads remaining funds');
  }

  const template = await getGoogleAdsFundsAlertTemplateStatus();

  if (options?.test) {
    if (!numbers.length) {
      return { sent: 0, skipped: true, reason: 'No WhatsApp alert numbers', remaining, threshold, funds, template };
    }
    const results = [];
    for (const phone of numbers) {
      const result = await sendFundsAlertToNumber(phone, funds, threshold, {
        test: true,
        canSendTemplate: template.canSendTemplate,
      });
      results.push({ phone, ...result });
    }
    return {
      sent: results.filter((r) => r.success).length,
      skipped: false,
      remaining,
      threshold,
      funds,
      results,
      template,
    };
  }

  if (!enabled) return { sent: 0, skipped: true, reason: 'Funds alert disabled', remaining, threshold, funds };
  if (!numbers.length) return { sent: 0, skipped: true, reason: 'No WhatsApp alert numbers', remaining, threshold, funds };
  if (remaining == null) {
    return {
      sent: 0,
      skipped: true,
      reason: 'Invoice / unlimited account — prepaid remaining API nahi deta',
      remaining,
      threshold,
      funds,
    };
  }
  if (remaining >= threshold) {
    if (remaining >= threshold + RECOVER_BUFFER && lastSentAt) {
      await writeSetting(LAST_SENT_KEY, '', 'Cleared after funds recovered');
    }
    return { sent: 0, skipped: true, reason: `Remaining ${inr(remaining)} above ${inr(threshold)}`, remaining, threshold, funds };
  }

  const lastMs = lastSentAt ? Date.parse(lastSentAt) : 0;
  if (!options?.force && lastMs && Date.now() - lastMs < COOLDOWN_MS) {
    return { sent: 0, skipped: true, reason: 'Already alerted in last 12 hours', remaining, threshold, funds };
  }

  const results = [];
  for (const phone of numbers) {
    const result = await sendFundsAlertToNumber(phone, funds, threshold, {
      canSendTemplate: template.canSendTemplate,
    });
    results.push({ phone, ...result });
  }
  const sent = results.filter((r) => r.success).length;
  if (sent > 0) await writeSetting(LAST_SENT_KEY, now, 'Last Google Ads low-funds WhatsApp');
  return { sent, skipped: sent === 0, remaining, threshold, funds, results, template };
}
