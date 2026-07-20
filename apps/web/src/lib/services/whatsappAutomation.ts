import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { normalizePhoneNumber, sendTemplateMessage, type WhatsAppSendResult } from '@/lib/services/whatsappService';

export const WHATSAPP_AUTOMATION_TRIGGER_KEYS = [
  'booking_confirmed',
  'booking_incomplete',
  'membership_payment_success',
  'membership_payment_failed',
  'app_session_incomplete',
  'admin_daily_summary',
  'service_due_reminder',
  'membership_expiring',
  'membership_claim_submitted',
  'membership_claim_approved',
  'membership_claim_rejected',
  'account_deleted',
  'app_uninstalled',
] as const;

/** Triggers picked up by /api/cron/whatsapp-automation */
export const WHATSAPP_AUTOMATION_CRON_TRIGGER_KEYS = [
  'booking_incomplete',
  'admin_daily_summary',
  'service_due_reminder',
  'membership_expiring',
] as const;

export type WhatsAppAutomationCronTriggerKey = (typeof WHATSAPP_AUTOMATION_CRON_TRIGGER_KEYS)[number];

export const WHATSAPP_AUTOMATION_CRON_MASTER_SETTING_KEY = 'whatsapp_automation_cron_master_enabled';

export function isCronEligibleAutomationTrigger(
  triggerKey: WhatsAppAutomationTriggerKey,
): triggerKey is WhatsAppAutomationCronTriggerKey {
  return (WHATSAPP_AUTOMATION_CRON_TRIGGER_KEYS as readonly string[]).includes(triggerKey);
}

export const WHATSAPP_AUTOMATION_CRON_SCHEDULE_HINTS: Record<WhatsAppAutomationCronTriggerKey, string> = {
  booking_incomplete: 'Daily scan — inactive drafts 24h+',
  admin_daily_summary: 'Daily 9 AM IST',
  service_due_reminder: 'Mondays IST — 6 months since last service',
  membership_expiring: 'Daily — memberships expiring within 7 days',
};

export type WhatsAppAutomationTriggerKey = (typeof WHATSAPP_AUTOMATION_TRIGGER_KEYS)[number];

export type WhatsAppAutomationSetting = {
  trigger_key: string;
  display_name: string;
  description: string | null;
  template_name: string;
  template_language: string;
  template_category: string;
  template_body: string;
  variable_keys: string[];
  is_enabled: boolean;
  cron_enabled: boolean;
  cooldown_hours: number;
  phase: string;
};

export type SendAutomationWhatsAppInput = {
  triggerKey: WhatsAppAutomationTriggerKey;
  phone: string;
  customerId?: string | null;
  templateParams: string[];
  payload?: Record<string, unknown>;
  /** Admin/test only */
  skipEnabledCheck?: boolean;
  skipCooldownCheck?: boolean;
  skipTemplateApprovalCheck?: boolean;
};

export type SendAutomationWhatsAppResult = {
  sent: boolean;
  skipped: boolean;
  skipReason?: string;
  triggerKey: WhatsAppAutomationTriggerKey;
  templateName?: string;
  phone?: string;
  messageId?: string;
  error?: string;
  deliveryStatus: 'SENT' | 'FAILED' | 'SKIPPED';
};

function fillTemplateBody(templateBody: string, params: string[]) {
  let output = templateBody;
  params.forEach((value, index) => {
    output = output.replaceAll(`{{${index + 1}}}`, String(value ?? '').trim());
  });
  return output;
}

export async function getAutomationSetting(
  triggerKey: WhatsAppAutomationTriggerKey
): Promise<WhatsAppAutomationSetting | null> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from('whatsapp_automation_settings')
    .select(
      'trigger_key, display_name, description, template_name, template_language, template_category, template_body, variable_keys, is_enabled, cron_enabled, cooldown_hours, phase'
    )
    .eq('trigger_key', triggerKey)
    .maybeSingle();

  if (error || !data) return null;

  return {
    ...data,
    variable_keys: Array.isArray(data.variable_keys)
      ? data.variable_keys.map((value) => String(value))
      : [],
    cron_enabled: Boolean((data as { cron_enabled?: boolean }).cron_enabled),
  } as WhatsAppAutomationSetting;
}

function toBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export async function isWhatsAppAutomationCronMasterEnabled(): Promise<boolean> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return true;

  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', WHATSAPP_AUTOMATION_CRON_MASTER_SETTING_KEY)
    .maybeSingle();

  return toBool(data?.setting_value, true);
}

export async function setWhatsAppAutomationCronMasterEnabled(
  enabled: boolean,
  updatedBy?: string | null,
): Promise<{ ok: true; enabled: boolean } | { ok: false; error: string }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, error: 'Database admin client unavailable' };

  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: WHATSAPP_AUTOMATION_CRON_MASTER_SETTING_KEY,
      setting_value: enabled ? 'true' : 'false',
      setting_type: 'BOOLEAN',
      category: 'NOTIFICATIONS',
      description: 'Master switch for WhatsApp automation cron scheduler.',
      default_value: 'true',
      is_editable: true,
      updated_at: new Date().toISOString(),
      ...(updatedBy ? { updated_by: updatedBy } : {}),
    },
    { onConflict: 'setting_key' },
  );

  if (error) return { ok: false, error: error.message || 'Failed to save cron master switch' };
  return { ok: true, enabled };
}

export async function assertAutomationCronJobAllowed(
  triggerKey: WhatsAppAutomationCronTriggerKey,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const master = await isWhatsAppAutomationCronMasterEnabled();
  if (!master) return { allowed: false, reason: 'cron_master_disabled' };

  const setting = await getAutomationSetting(triggerKey);
  if (!setting) return { allowed: false, reason: 'trigger_not_found' };
  if (!setting.is_enabled) return { allowed: false, reason: 'trigger_inactive' };
  if (!setting.cron_enabled) return { allowed: false, reason: 'cron_disabled_for_trigger' };

  return { allowed: true };
}

export async function isAutomationTemplateApproved(templateName: string): Promise<boolean> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return false;

  const { data } = await supabaseAdmin
    .from('whatsapp_templates')
    .select('is_active, category, meta')
    .eq('template_name', templateName)
    .maybeSingle();

  if (!data) return false;

  if ((data as { is_active?: boolean }).is_active === false) return false;

  const metaStatus = String((data as { meta?: { status?: string } }).meta?.status || '').toUpperCase();
  const approved = Boolean((data as { is_active?: boolean }).is_active) || metaStatus === 'APPROVED';
  if (!approved) return false;

  const category = String(
    (data as { category?: string; meta?: { category?: string } }).category ||
      (data as { meta?: { category?: string } }).meta?.category ||
      'UTILITY'
  ).toUpperCase();

  return category === 'UTILITY';
}

export async function isWithinAutomationCooldown(input: {
  triggerKey: WhatsAppAutomationTriggerKey;
  phone: string;
  cooldownHours: number;
}): Promise<boolean> {
  if (input.cooldownHours <= 0) return false;

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return false;

  const since = new Date(Date.now() - input.cooldownHours * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from('whatsapp_trigger_logs')
    .select('id')
    .eq('trigger_key', input.triggerKey)
    .eq('phone', input.phone)
    .eq('delivery_status', 'SENT')
    .gte('sent_at', since)
    .limit(1)
    .maybeSingle();

  return Boolean(data);
}

async function logAutomationAttempt(input: {
  triggerKey: WhatsAppAutomationTriggerKey;
  phone: string;
  customerId?: string | null;
  templateName?: string;
  providerMessageId?: string | null;
  deliveryStatus: 'SENT' | 'FAILED' | 'SKIPPED';
  skipReason?: string | null;
  payload?: Record<string, unknown>;
  sendResult?: WhatsAppSendResult;
  filledBody?: string;
  templateLanguage?: string;
}) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  const now = new Date().toISOString();
  const payload = {
    ...(input.payload || {}),
    response: input.sendResult?.raw ?? null,
  };

  await supabaseAdmin.from('whatsapp_trigger_logs').insert({
    trigger_key: input.triggerKey,
    customer_id: input.customerId || null,
    phone: input.phone,
    template_name: input.templateName || null,
    provider_message_id: input.providerMessageId || null,
    delivery_status: input.deliveryStatus,
    skip_reason: input.skipReason || null,
    payload,
    sent_at: now,
  });

  if (input.deliveryStatus === 'SKIPPED' || !input.templateName) return;

  await supabaseAdmin.from('whatsapp_messages').insert({
    provider_message_id: input.providerMessageId || null,
    direction: 'OUTBOUND',
    message_type: 'TEMPLATE',
    recipient_phone: input.phone,
    template_name: input.templateName,
    template_language: input.templateLanguage || 'en',
    text_body: input.filledBody || null,
    status: input.deliveryStatus === 'SENT' ? 'SENT' : 'FAILED',
    status_at: now,
    error_message: input.deliveryStatus === 'SENT' ? null : input.sendResult?.error || input.skipReason || null,
    payload: {
      request: {
        trigger_key: input.triggerKey,
        phone: input.phone,
        customer_id: input.customerId || null,
        params: input.payload?.templateParams || null,
      },
      response: input.sendResult?.raw ?? null,
    },
    meta: { source: 'whatsapp_automation', trigger_key: input.triggerKey },
    updated_at: now,
  });
}

function skippedResult(
  input: SendAutomationWhatsAppInput,
  skipReason: string,
  templateName?: string
): SendAutomationWhatsAppResult {
  return {
    sent: false,
    skipped: true,
    skipReason,
    triggerKey: input.triggerKey,
    templateName,
    phone: normalizePhoneNumber(input.phone) || undefined,
    deliveryStatus: 'SKIPPED',
  };
}

export async function sendAutomationWhatsApp(
  input: SendAutomationWhatsAppInput
): Promise<SendAutomationWhatsAppResult> {
  const phone = normalizePhoneNumber(input.phone);
  if (!phone) {
    const result = skippedResult(input, 'invalid_phone');
    await logAutomationAttempt({
      triggerKey: input.triggerKey,
      phone: input.phone,
      customerId: input.customerId,
      deliveryStatus: 'SKIPPED',
      skipReason: 'invalid_phone',
      payload: input.payload,
    });
    return result;
  }

  const setting = await getAutomationSetting(input.triggerKey);
  if (!setting) {
    const result = skippedResult(input, 'trigger_not_configured');
    await logAutomationAttempt({
      triggerKey: input.triggerKey,
      phone,
      customerId: input.customerId,
      deliveryStatus: 'SKIPPED',
      skipReason: 'trigger_not_configured',
      payload: input.payload,
    });
    return result;
  }

  if (!setting.is_enabled && !input.skipEnabledCheck) {
    const result = skippedResult(input, 'trigger_disabled', setting.template_name);
    await logAutomationAttempt({
      triggerKey: input.triggerKey,
      phone,
      customerId: input.customerId,
      templateName: setting.template_name,
      deliveryStatus: 'SKIPPED',
      skipReason: 'trigger_disabled',
      payload: { ...input.payload, templateParams: input.templateParams },
    });
    return result;
  }

  if (!input.skipCooldownCheck) {
    const onCooldown = await isWithinAutomationCooldown({
      triggerKey: input.triggerKey,
      phone,
      cooldownHours: setting.cooldown_hours,
    });
    if (onCooldown) {
      const result = skippedResult(input, 'cooldown_active', setting.template_name);
      await logAutomationAttempt({
        triggerKey: input.triggerKey,
        phone,
        customerId: input.customerId,
        templateName: setting.template_name,
        deliveryStatus: 'SKIPPED',
        skipReason: 'cooldown_active',
        payload: { ...input.payload, templateParams: input.templateParams },
      });
      return result;
    }
  }

  if (!input.skipTemplateApprovalCheck) {
    const approved = await isAutomationTemplateApproved(setting.template_name);
    if (!approved) {
      const result = skippedResult(input, 'template_not_approved', setting.template_name);
      await logAutomationAttempt({
        triggerKey: input.triggerKey,
        phone,
        customerId: input.customerId,
        templateName: setting.template_name,
        deliveryStatus: 'SKIPPED',
        skipReason: 'template_not_approved',
        payload: { ...input.payload, templateParams: input.templateParams },
      });
      return result;
    }
  }

  const sendResult = await sendTemplateMessage({
    phoneNumber: phone,
    templateName: setting.template_name,
    templateParams: input.templateParams,
    languageCode: setting.template_language || 'en',
  });

  const filledBody = fillTemplateBody(setting.template_body, input.templateParams);

  await logAutomationAttempt({
    triggerKey: input.triggerKey,
    phone,
    customerId: input.customerId,
    templateName: setting.template_name,
    providerMessageId: sendResult.messageId || null,
    deliveryStatus: sendResult.success ? 'SENT' : 'FAILED',
    skipReason: sendResult.success ? null : sendResult.error || 'send_failed',
    payload: { ...input.payload, templateParams: input.templateParams },
    sendResult,
    filledBody,
    templateLanguage: setting.template_language,
  });

  if (!sendResult.success) {
    return {
      sent: false,
      skipped: false,
      triggerKey: input.triggerKey,
      templateName: setting.template_name,
      phone,
      messageId: sendResult.messageId,
      error: sendResult.error,
      deliveryStatus: 'FAILED',
    };
  }

  return {
    sent: true,
    skipped: false,
    triggerKey: input.triggerKey,
    templateName: setting.template_name,
    phone,
    messageId: sendResult.messageId,
    deliveryStatus: 'SENT',
  };
}

export async function listAutomationSettings(): Promise<WhatsAppAutomationSetting[]> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];

  const { data, error } = await supabaseAdmin
    .from('whatsapp_automation_settings')
    .select(
      'trigger_key, display_name, description, template_name, template_language, template_category, template_body, variable_keys, is_enabled, cron_enabled, cooldown_hours, phase'
    )
    .order('phase', { ascending: true })
    .order('trigger_key', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    ...row,
    variable_keys: Array.isArray(row.variable_keys) ? row.variable_keys.map((value) => String(value)) : [],
    cron_enabled: Boolean((row as { cron_enabled?: boolean }).cron_enabled),
  })) as WhatsAppAutomationSetting[];
}
