import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendTextMessage } from '@/lib/services/whatsappService';
import {
  buildOpenAiBalanceTemplateParams,
  getOpenAiBalanceAlertTemplateStatus,
  sendOpenAiBalanceAlertTemplateMessage,
} from '@/lib/services/openAiBalanceAlertTemplate';
import { getMisaAiUsdInrRate } from '@/lib/chatbot_v2/misaAiBilling';
import { getOpenAiOrgSpendUsdInRange } from '@/lib/chatbot_v2/openAiOrgUsage';
import { getEnabledSystemAlertWhatsAppNumbers } from '@/lib/services/systemAlertWhatsAppNumbers';

const DEFAULT_ALERT_MILESTONES_USD = [5, 4, 3, 2, 1];

/** OpenAI daily costs API rejects ranges shorter than ~1 UTC day */
const MIN_OPENAI_COSTS_RANGE_SECONDS = 86400;

const SETTING_KEYS = {
  baselineUsd: 'openai_credit_baseline_usd',
  baselineAt: 'openai_credit_baseline_at',
  thresholdUsd: 'openai_credit_alert_threshold_usd',
  alertEnabled: 'openai_credit_alert_enabled',
  lastSentAt: 'openai_credit_alert_last_sent_at',
  milestonesUsd: 'openai_credit_alert_milestones_usd',
  milestonesSent: 'openai_credit_alert_milestones_sent',
} as const;

export type OpenAiCreditBalanceSettings = {
  baseline_usd: number | null;
  baseline_at: string | null;
  alert_threshold_usd: number;
  alert_milestones_usd: number[];
  alert_milestones_sent: number[];
  alert_enabled: boolean;
  last_alert_sent_at: string | null;
};

export type OpenAiCreditBalanceStatus = {
  configured: boolean;
  admin_api_available: boolean;
  settings: OpenAiCreditBalanceSettings;
  spend_since_baseline_usd: number | null;
  estimated_remaining_usd: number | null;
  estimated_remaining_inr: number | null;
  is_low: boolean;
  alert_ready: boolean;
  pending_milestones_usd: number[];
  whatsapp_configured: boolean;
  error?: string;
  note: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNumber(value: string | undefined | null, fallback: number): number {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalUsd(value: string | undefined | null): number | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseMilestones(value: string | undefined | null): number[] {
  const raw = String(value ?? '').trim();
  const source = raw || DEFAULT_ALERT_MILESTONES_USD.join(',');
  const parsed = source
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
  const unique = Array.from(new Set(parsed));
  return unique.length > 0 ? unique.sort((a, b) => b - a) : [...DEFAULT_ALERT_MILESTONES_USD];
}

function parseSentMilestones(value: string | undefined | null): number[] {
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function formatSentMilestones(values: number[]) {
  return Array.from(new Set(values))
    .sort((a, b) => b - a)
    .join(',');
}

function getPendingMilestones(remaining: number, milestones: number[], sent: number[]) {
  const sentSet = new Set(sent);
  return milestones.filter((milestone) => remaining <= milestone && !sentSet.has(milestone));
}

async function readSettingsMap(): Promise<Map<string, string>> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return new Map();

  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', Object.values(SETTING_KEYS));

  return new Map((data || []).map((row) => [String(row.setting_key), String(row.setting_value ?? '')]));
}

function settingsFromMap(map: Map<string, string>): OpenAiCreditBalanceSettings {
  const alert_milestones_usd = parseMilestones(map.get(SETTING_KEYS.milestonesUsd));
  return {
    baseline_usd: parseOptionalUsd(map.get(SETTING_KEYS.baselineUsd)),
    baseline_at: String(map.get(SETTING_KEYS.baselineAt) || '').trim() || null,
    alert_threshold_usd: Math.max(0, parseNumber(map.get(SETTING_KEYS.thresholdUsd), alert_milestones_usd[0] || 5)),
    alert_milestones_usd,
    alert_milestones_sent: parseSentMilestones(map.get(SETTING_KEYS.milestonesSent)),
    alert_enabled: String(map.get(SETTING_KEYS.alertEnabled) || 'true').trim() !== 'false',
    last_alert_sent_at: String(map.get(SETTING_KEYS.lastSentAt) || '').trim() || null,
  };
}

async function upsertSetting(
  key: string,
  value: string,
  type: 'BOOLEAN' | 'STRING',
  description: string,
) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error('Supabase admin client not available');

  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: key,
      setting_value: value,
      setting_type: type,
      category: 'MISA_AI',
      description,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  if (error) throw new Error(error.message || `Could not save ${key}`);
}

async function saveSentMilestones(values: number[]) {
  await upsertSetting(
    SETTING_KEYS.milestonesSent,
    formatSentMilestones(values),
    'STRING',
    'Milestone USD values already alerted in current low-balance cycle',
  );
}

async function clearSentMilestones() {
  await upsertSetting(SETTING_KEYS.milestonesSent, '', 'STRING', 'Milestone USD values already alerted in current low-balance cycle');
  await upsertSetting(SETTING_KEYS.lastSentAt, '', 'STRING', 'Last low-balance alert sent at');
}

export async function getOpenAiCreditBalanceSettings(): Promise<OpenAiCreditBalanceSettings> {
  const map = await readSettingsMap();
  return settingsFromMap(map);
}

export async function saveOpenAiCreditBalanceSettings(input: {
  baseline_usd?: number | null;
  alert_threshold_usd?: number;
  alert_enabled?: boolean;
  reset_baseline?: boolean;
}): Promise<OpenAiCreditBalanceSettings> {
  const current = await getOpenAiCreditBalanceSettings();
  const nowIso = new Date().toISOString();

  if (input.reset_baseline || input.baseline_usd !== undefined) {
    const nextBaseline =
      input.baseline_usd === undefined || input.baseline_usd === null
        ? current.baseline_usd
        : Math.max(0, Number(input.baseline_usd));

    if (nextBaseline === null || !Number.isFinite(nextBaseline)) {
      throw new Error('Baseline balance (USD) is required');
    }

    await upsertSetting(
      SETTING_KEYS.baselineUsd,
      String(nextBaseline),
      'STRING',
      'Prepaid credit balance when last topped up',
    );
    await upsertSetting(SETTING_KEYS.baselineAt, nowIso, 'STRING', 'When baseline was last set');
    await clearSentMilestones();
  }

  if (input.alert_threshold_usd !== undefined) {
    const threshold = Math.max(0, Number(input.alert_threshold_usd));
    await upsertSetting(
      SETTING_KEYS.thresholdUsd,
      String(threshold),
      'STRING',
      'Highest OpenAI balance alert milestone in USD',
    );
  }

  if (input.alert_enabled !== undefined) {
    await upsertSetting(
      SETTING_KEYS.alertEnabled,
      input.alert_enabled ? 'true' : 'false',
      'BOOLEAN',
      'Enable low-balance WhatsApp alerts',
    );
  }

  return getOpenAiCreditBalanceSettings();
}

export async function getOpenAiCreditBalanceStatus(): Promise<OpenAiCreditBalanceStatus> {
  const adminKey = Boolean(
    process.env.OPENAI_ADMIN_API_KEY?.trim() || process.env.OPENAI_ADMIN_KEY?.trim(),
  );
  const settings = await getOpenAiCreditBalanceSettings();
  const alertNumbers = await getEnabledSystemAlertWhatsAppNumbers();
  const whatsappConfigured = alertNumbers.length > 0;
  const usdInr = getMisaAiUsdInrRate();
  const highestMilestone = settings.alert_milestones_usd[0] ?? settings.alert_threshold_usd;

  if (!settings.baseline_usd || !settings.baseline_at) {
    return {
      configured: false,
      admin_api_available: adminKey,
      settings,
      spend_since_baseline_usd: null,
      estimated_remaining_usd: null,
      estimated_remaining_inr: null,
      is_low: false,
      alert_ready: false,
      pending_milestones_usd: [],
      whatsapp_configured: whatsappConfigured,
      note: 'Set your current OpenAI prepaid balance after each top-up. Alerts fire at $5, $4, $3, $2 and $1 milestones.',
    };
  }

  if (!adminKey) {
    return {
      configured: false,
      admin_api_available: false,
      settings,
      spend_since_baseline_usd: null,
      estimated_remaining_usd: null,
      estimated_remaining_inr: null,
      is_low: false,
      alert_ready: false,
      pending_milestones_usd: [],
      whatsapp_configured: whatsappConfigured,
      error: 'OPENAI_ADMIN_API_KEY is not configured',
      note: 'Admin API key is required to fetch org costs since baseline date.',
    };
  }

  try {
    const startUnix = Math.floor(new Date(settings.baseline_at).getTime() / 1000);
    const endUnix = Math.floor(Date.now() / 1000);

    if (!Number.isFinite(startUnix) || startUnix <= 0) {
      throw new Error('Invalid baseline date — save baseline again');
    }

    const rangeSeconds = endUnix - startUnix;
    const spendSinceBaseline = await getOpenAiOrgSpendUsdInRange(startUnix, endUnix);
    const estimatedRemaining = Math.max(0, settings.baseline_usd - spendSinceBaseline);
    const pendingMilestones = getPendingMilestones(
      estimatedRemaining,
      settings.alert_milestones_usd,
      settings.alert_milestones_sent,
    );
    const isLow = estimatedRemaining <= highestMilestone;
    const trackingNote =
      rangeSeconds < MIN_OPENAI_COSTS_RANGE_SECONDS
        ? ' Recent baseline — spend updates from live OpenAI usage (within minutes).'
        : '';

    return {
      configured: true,
      admin_api_available: true,
      settings,
      spend_since_baseline_usd: Number(spendSinceBaseline.toFixed(4)),
      estimated_remaining_usd: Number(estimatedRemaining.toFixed(4)),
      estimated_remaining_inr: Math.round(estimatedRemaining * usdInr),
      is_low: isLow,
      alert_ready:
        pendingMilestones.length > 0 && settings.alert_enabled && whatsappConfigured,
      pending_milestones_usd: pendingMilestones,
      whatsapp_configured: whatsappConfigured,
      note: `Alerts at $5, $4, $3, $2 and $1 — each milestone once per top-up cycle. Update baseline after manual top-ups.${trackingNote}`,
    };
  } catch (error: unknown) {
    return {
      configured: true,
      admin_api_available: true,
      settings,
      spend_since_baseline_usd: null,
      estimated_remaining_usd: null,
      estimated_remaining_inr: null,
      is_low: false,
      alert_ready: false,
      pending_milestones_usd: [],
      whatsapp_configured: whatsappConfigured,
      error: error instanceof Error ? error.message : String(error),
      note: 'Could not fetch OpenAI costs for balance estimate.',
    };
  }
}

function truncate(value: string, max = 900) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function buildAlertMessage(status: OpenAiCreditBalanceStatus, milestoneUsd: number): string {
  const remaining = status.estimated_remaining_usd ?? 0;
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  return (
    `*MyFNG OpenAI Balance Alert*\n\n` +
    `Estimated remaining credit: *$${remaining.toFixed(2)}* (≈₹${(status.estimated_remaining_inr ?? 0).toLocaleString('en-IN')})\n` +
    `Milestone reached: *$${milestoneUsd}*\n` +
    `Spent since baseline: $${(status.spend_since_baseline_usd ?? 0).toFixed(2)}\n\n` +
    `Top up at platform.openai.com/settings/organization/billing\n` +
    `After top-up, update baseline in MISA AI dashboard.\n\n` +
    `_${timestamp}_`
  );
}

function buildBalanceTemplateParams(
  status: OpenAiCreditBalanceStatus,
  milestoneUsd: number,
  test = false,
): string[] {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const remaining = status.estimated_remaining_usd ?? milestoneUsd;
  const statusLabel = test ? 'TEST ALERT' : `OPENAI BALANCE ≤ $${milestoneUsd}`;
  const details = test
    ? 'This is a test alert from MISA AI dashboard. Milestone alerts are configured at $5, $4, $3, $2 and $1.'
    : truncate(
        `Balance crossed the $${milestoneUsd} milestone.\n` +
          `Current estimate: $${remaining.toFixed(2)}.\n` +
          'Please top up at platform.openai.com/settings/organization/billing and update baseline in MISA AI admin.',
      );

  return buildOpenAiBalanceTemplateParams({
    timestamp,
    status: statusLabel,
    remainingUsd: remaining,
    thresholdUsd: milestoneUsd,
    details,
  });
}

async function sendBalanceAlertToNumber(
  phoneNumber: string,
  status: OpenAiCreditBalanceStatus,
  milestoneUsd: number,
  options?: { test?: boolean; preferTemplate?: boolean },
): Promise<{ success: boolean; error?: string; messageId?: string; deliveryMode: 'template' | 'text' }> {
  const templateStatus = await getOpenAiBalanceAlertTemplateStatus();
  const textMessage = options?.test
    ? `*TEST - MyFNG OpenAI Balance Alert*\n\n${buildAlertMessage(
        {
          ...status,
          estimated_remaining_usd: status.estimated_remaining_usd ?? milestoneUsd,
          is_low: true,
        },
        milestoneUsd,
      )}`
    : buildAlertMessage(status, milestoneUsd);

  const useTemplate = options?.preferTemplate !== false && templateStatus.canSendTemplate;
  if (useTemplate) {
    const result = await sendOpenAiBalanceAlertTemplateMessage(
      phoneNumber,
      buildBalanceTemplateParams(status, milestoneUsd, options?.test),
    );
    return {
      success: result.success,
      error: result.error,
      messageId: result.messageId,
      deliveryMode: 'template',
    };
  }

  const result = await sendTextMessage(phoneNumber, textMessage);
  return {
    success: result.success,
    error: result.success
      ? undefined
      : result.error ||
        'Text delivery failed. Create and approve openai_balance_alert template in MISA AI dashboard for 24/7 alerts.',
    messageId: result.messageId,
    deliveryMode: 'text',
  };
}

export async function runOpenAiCreditBalanceAlert(options?: {
  force?: boolean;
  test?: boolean;
}): Promise<{
  sent: number;
  skipped: boolean;
  reason?: string;
  status: OpenAiCreditBalanceStatus;
  milestones_alerted?: number[];
  results: Array<{
    number: string;
    success: boolean;
    error?: string;
    messageId?: string;
    deliveryMode?: string;
    milestone_usd?: number;
  }>;
  deliveryMode?: 'template' | 'text' | 'mixed';
  templateAvailable?: boolean;
}> {
  const status = await getOpenAiCreditBalanceStatus();
  const templateStatus = await getOpenAiBalanceAlertTemplateStatus();
  const milestones = status.settings.alert_milestones_usd;
  const highestMilestone = milestones[0] ?? 5;
  let sentMilestones = [...status.settings.alert_milestones_sent];

  if (options?.test) {
    if (!status.whatsapp_configured) {
      return {
        sent: 0,
        skipped: true,
        reason: 'SYSTEM_ALERT_WHATSAPP_NUMBERS not configured',
        status,
        results: [],
        templateAvailable: templateStatus.canSendTemplate,
      };
    }
    const testMilestone = milestones[0] ?? 5;
    const testStatus: OpenAiCreditBalanceStatus = {
      ...status,
      estimated_remaining_usd: status.estimated_remaining_usd ?? testMilestone,
      is_low: true,
    };
    const alertNumbers = await getEnabledSystemAlertWhatsAppNumbers();
    const results = [];
    for (const number of alertNumbers) {
      const result = await sendBalanceAlertToNumber(number, testStatus, testMilestone, { test: true });
      results.push({ number, milestone_usd: testMilestone, ...result });
    }
    const sent = results.filter((row) => row.success).length;
    const deliveryModes = new Set(results.map((row) => row.deliveryMode));
    return {
      sent,
      skipped: sent === 0,
      reason:
        sent === 0
          ? templateStatus.canSendTemplate
            ? 'WhatsApp API rejected all numbers — check results for details'
            : 'Create openai_balance_alert template in MISA AI dashboard (text-only works within 24h WhatsApp window)'
          : undefined,
      status,
      results,
      deliveryMode: deliveryModes.size > 1 ? 'mixed' : (results[0]?.deliveryMode as 'template' | 'text' | undefined),
      templateAvailable: templateStatus.canSendTemplate,
    };
  }

  if (!status.configured || status.estimated_remaining_usd === null) {
    return { sent: 0, skipped: true, reason: status.error || 'Balance monitor not configured', status, results: [] };
  }

  if (!status.whatsapp_configured) {
    return { sent: 0, skipped: true, reason: 'SYSTEM_ALERT_WHATSAPP_NUMBERS not configured', status, results: [] };
  }

  if (!status.settings.alert_enabled) {
    return { sent: 0, skipped: true, reason: 'Balance alerts are disabled', status, results: [] };
  }

  const remaining = status.estimated_remaining_usd;
  const recoverAbove = highestMilestone + 1;
  if (remaining > recoverAbove && sentMilestones.length > 0) {
    await clearSentMilestones();
    sentMilestones = [];
    status.settings.alert_milestones_sent = [];
    status.settings.last_alert_sent_at = null;
  }

  const pendingMilestones = getPendingMilestones(remaining, milestones, sentMilestones);
  if (!options?.force && pendingMilestones.length === 0) {
    return {
      sent: 0,
      skipped: true,
      reason: remaining > highestMilestone ? 'Balance above alert milestones' : 'All reached milestones already alerted',
      status,
      results: [],
      templateAvailable: templateStatus.canSendTemplate,
    };
  }

  const milestonesToSend = options?.force ? pendingMilestones : pendingMilestones;
  const results: Array<{
    number: string;
    success: boolean;
    error?: string;
    messageId?: string;
    deliveryMode?: string;
    milestone_usd?: number;
  }> = [];
  const milestonesAlerted: number[] = [];

  const alertNumbers = await getEnabledSystemAlertWhatsAppNumbers();
  for (const milestoneUsd of milestonesToSend) {
    let milestoneSent = false;
    for (const number of alertNumbers) {
      const result = await sendBalanceAlertToNumber(number, status, milestoneUsd);
      results.push({ number, milestone_usd: milestoneUsd, ...result });
      if (result.success) milestoneSent = true;
      await sleep(300);
    }
    if (milestoneSent) {
      milestonesAlerted.push(milestoneUsd);
      sentMilestones.push(milestoneUsd);
    }
  }

  if (milestonesAlerted.length > 0) {
    await saveSentMilestones(sentMilestones);
    await upsertSetting(SETTING_KEYS.lastSentAt, new Date().toISOString(), 'STRING', 'Last low-balance alert sent at');
    status.settings.alert_milestones_sent = sentMilestones;
    status.settings.last_alert_sent_at = new Date().toISOString();
  }

  const sent = results.filter((row) => row.success).length;
  const deliveryModes = new Set(results.map((row) => row.deliveryMode));
  return {
    sent,
    skipped: sent === 0,
    reason: sent === 0 ? 'WhatsApp delivery failed for all milestone alerts' : undefined,
    status,
    milestones_alerted: milestonesAlerted,
    results,
    deliveryMode: deliveryModes.size > 1 ? 'mixed' : (results[0]?.deliveryMode as 'template' | 'text' | undefined),
    templateAvailable: templateStatus.canSendTemplate,
  };
}
