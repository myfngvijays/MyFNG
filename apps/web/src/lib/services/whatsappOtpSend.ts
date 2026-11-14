/**
 * Sends the WhatsApp OTP template using the live Meta template definition
 * so body/button parameters match after WABA migration or repush.
 */

import {
  getResolvedWhatsAppAgentsCredentials,
} from '@/lib/whatsappAgents/shared/envConfigStore';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import type { WhatsAppSendResult } from '@/lib/services/whatsappService';
import { normalizePhoneNumber } from '@/lib/services/whatsappService';
import { loadOtpChannelConfig } from '@/lib/otp/channelConfig';
import { archiveSentOtpMessage } from '@/lib/whatsapp/otpInbox';

type OtpCreds = {
  whatsapp_access_token: string;
  whatsapp_phone_number_id: string;
  whatsapp_business_account_id: string;
  whatsapp_api_url: string;
  preferred: boolean;
};

type SenderHealth = 'healthy' | 'down' | 'unknown';

type OtpSendResult = WhatsAppSendResult & {
  attempts?: Array<{ label: string; error?: string; statusCode?: number }>;
  senderPhoneNumberId?: string;
  triedPhoneNumberIds?: string[];
};

type MetaTemplateComponent = {
  type?: string;
  text?: string;
  buttons?: Array<{
    type?: string;
    text?: string;
    url?: string;
    otp_type?: string;
  }>;
};

type MetaOtpTemplate = {
  id?: string;
  name?: string;
  language?: string;
  category?: string;
  status?: string;
  components?: MetaTemplateComponent[];
};

type SendAttempt = {
  label: string;
  languageCode: string;
  components: Array<Record<string, unknown>>;
};

const OTP_TEMPLATE_NAMES = ['otp', 'otp_verification', 'verification_code'];

function countBodyVariables(bodyText: string): number {
  const matches = bodyText.match(/\{\{\s*\d+\s*\}\}/g) || [];
  const indexes = new Set(
    matches
      .map((token) => Number(token.replace(/[^\d]/g, '')))
      .filter((num) => Number.isFinite(num) && num > 0),
  );
  return indexes.size || (bodyText.includes('{{') ? 1 : 0);
}

function buildBodyParameters(otpCode: string, variableCount: number) {
  const count = Math.max(1, variableCount || 1);
  return Array.from({ length: count }, () => ({ type: 'text', text: otpCode }));
}

function buildAttemptsForTemplate(template: MetaOtpTemplate, otpCode: string): SendAttempt[] {
  const languageCode = String(template.language || 'en').trim() || 'en';
  const components = Array.isArray(template.components) ? template.components : [];
  const bodyComponent = components.find((row) => String(row?.type || '').toUpperCase() === 'BODY');
  const bodyText = String(bodyComponent?.text || '');
  const bodyVariableCount = countBodyVariables(bodyText);
  const bodyParameters = buildBodyParameters(otpCode, bodyVariableCount);

  const buttonsComponent = components.find((row) => String(row?.type || '').toUpperCase() === 'BUTTONS');
  const buttons = Array.isArray(buttonsComponent?.buttons) ? buttonsComponent.buttons : [];

  const attempts: SendAttempt[] = [];

  if (buttons.length === 0) {
    attempts.push({
      label: 'body-only',
      languageCode,
      components: [{ type: 'body', parameters: bodyParameters }],
    });
    return attempts;
  }

  buttons.forEach((button, index) => {
    const buttonType = String(button?.type || '').toUpperCase();
    if (buttonType === 'OTP') {
      const otpType = String(button?.otp_type || 'COPY_CODE').toLowerCase();
      attempts.push({
        label: `otp-button-${index}-${otpType}`,
        languageCode,
        components: [
          { type: 'body', parameters: bodyParameters },
          {
            type: 'button',
            sub_type: 'otp',
            index: String(index),
            parameters: [{ type: 'otp', otp_type: otpType, text: otpCode }],
          },
        ],
      });
      return;
    }

    if (buttonType === 'URL') {
      attempts.push({
        label: `url-button-${index}`,
        languageCode,
        components: [
          { type: 'body', parameters: bodyParameters },
          {
            type: 'button',
            sub_type: 'url',
            index: String(index),
            parameters: [{ type: 'text', text: otpCode }],
          },
        ],
      });
    }
  });

  if (attempts.length === 0) {
    attempts.push({
      label: 'body-only-fallback',
      languageCode,
      components: [{ type: 'body', parameters: bodyParameters }],
    });
  }

  // Legacy fallbacks used before WABA migration.
  attempts.push(
    {
      label: 'legacy-en-url',
      languageCode: 'en',
      components: [
        { type: 'body', parameters: [{ type: 'text', text: otpCode }] },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: otpCode }],
        },
      ],
    },
    {
      label: 'legacy-en-body',
      languageCode: 'en',
      components: [{ type: 'body', parameters: [{ type: 'text', text: otpCode }] }],
    },
    {
      label: 'legacy-en-us-body',
      languageCode: 'en_US',
      components: [{ type: 'body', parameters: [{ type: 'text', text: otpCode }] }],
    },
  );

  return attempts;
}

async function fetchMetaTemplatesByName(
  creds: OtpCreds,
  templateName: string,
): Promise<MetaOtpTemplate[]> {
  const wabaId = creds.whatsapp_business_account_id;
  if (!wabaId) return [];

  const url = `${creds.whatsapp_api_url}/${wabaId}/message_templates?fields=id,name,status,language,category,components&limit=50&name=${encodeURIComponent(
    templateName,
  )}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${creds.whatsapp_access_token}` },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      String(payload?.error?.error_user_msg || payload?.error?.message || '').trim() ||
      `Meta template lookup failed (${response.status})`;
    throw new Error(message);
  }
  return Array.isArray(payload?.data) ? payload.data : [];
}

function pickBestOtpTemplate(templates: MetaOtpTemplate[]): MetaOtpTemplate | null {
  if (!templates.length) return null;
  const statusRank = (status: string) => {
    const normalized = status.toUpperCase();
    if (normalized === 'APPROVED') return 4;
    if (normalized === 'PENDING') return 3;
    if (normalized === 'IN_APPEAL') return 2;
    if (normalized === 'PAUSED') return 1;
    return 0;
  };
  const languageRank = (language: string) => {
    const code = language.toLowerCase();
    if (code === 'en') return 3;
    if (code === 'en_us') return 2;
    if (code.startsWith('en')) return 1;
    return 0;
  };

  return [...templates].sort((a, b) => {
    const statusDiff = statusRank(String(b.status || '')) - statusRank(String(a.status || ''));
    if (statusDiff !== 0) return statusDiff;
    return languageRank(String(b.language || '')) - languageRank(String(a.language || ''));
  })[0];
}

async function sendAttempt(
  creds: OtpCreds,
  phoneNumber: string,
  templateName: string,
  attempt: SendAttempt,
): Promise<WhatsAppSendResult> {
  const to = normalizePhoneNumber(phoneNumber);
  if (!to) return { success: false, error: 'Invalid recipient phone number' };

  const response = await fetch(`${creds.whatsapp_api_url}/${creds.whatsapp_phone_number_id}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creds.whatsapp_access_token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: attempt.languageCode },
        components: attempt.components,
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    try {
      const payload = await response.json();
      const message =
        payload?.error?.error_user_msg ||
        payload?.error?.message ||
        `WhatsApp API request failed (${response.status})`;
      return {
        success: false,
        error: String(message),
        statusCode: response.status,
        raw: payload,
      };
    } catch {
      return {
        success: false,
        error: `WhatsApp API request failed (${response.status})`,
        statusCode: response.status,
      };
    }
  }

  const data = await response.json();
  return {
    success: true,
    messageId: data?.messages?.[0]?.id,
    statusCode: response.status,
    raw: data,
  };
}

async function readSenderHealth(creds: OtpCreds): Promise<SenderHealth> {
  try {
    const response = await fetch(
      `${creds.whatsapp_api_url.replace(/\/$/, '')}/${creds.whatsapp_phone_number_id}?fields=quality_rating,status`,
      { headers: { Authorization: `Bearer ${creds.whatsapp_access_token}` }, cache: 'no-store' },
    );
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return 'unknown';
    const quality = String(json.quality_rating || '').toUpperCase();
    const status = String(json.status || '').toUpperCase();
    if (quality === 'RED') return 'down';
    if (['BANNED', 'RESTRICTED', 'DISCONNECTED', 'FLAGGED', 'MIGRATED'].includes(status)) return 'down';
    if (status && status !== 'CONNECTED') return 'down';
    return 'healthy';
  } catch {
    return 'unknown';
  }
}

async function loadOtpSenders(): Promise<OtpCreds[]> {
  const primary = await getResolvedWhatsAppAgentsCredentials(true);
  const senders: OtpCreds[] = [];
  if (
    primary.whatsapp_access_token?.trim() &&
    primary.whatsapp_phone_number_id?.trim() &&
    primary.whatsapp_business_account_id?.trim()
  ) {
    senders.push({
      whatsapp_access_token: primary.whatsapp_access_token,
      whatsapp_phone_number_id: primary.whatsapp_phone_number_id,
      whatsapp_business_account_id: primary.whatsapp_business_account_id,
      whatsapp_api_url: primary.whatsapp_api_url || 'https://graph.facebook.com/v25.0',
      preferred: true,
    });
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return senders;
  const { data } = await (supabaseAdmin as any)
    .from('wa_bulk_accounts')
    .select('phone_number_id, waba_id, access_token, api_url');
  for (const row of data || []) {
    const phoneId = String(row.phone_number_id || '').trim();
    const token = String(row.access_token || '').trim();
    const wabaId = String(row.waba_id || '').trim();
    if (!phoneId || !token) continue;
    if (senders.some((sender) => sender.whatsapp_phone_number_id === phoneId)) continue;
    senders.push({
      whatsapp_access_token: token,
      whatsapp_phone_number_id: phoneId,
      whatsapp_business_account_id: wabaId,
      whatsapp_api_url: String(row.api_url || primary.whatsapp_api_url || 'https://graph.facebook.com/v25.0'),
      preferred: false,
    });
  }
  return senders;
}

function shouldTryNextAccount(result: WhatsAppSendResult) {
  const code = Number((result.raw as { error?: { code?: number } } | undefined)?.error?.code || 0);
  if (code === 131026 || code === 131021) return false;
  const text = String(result.error || '').toLowerCase();
  if (text.includes('invalid recipient') || text.includes('not a valid whatsapp')) return false;
  return true;
}

async function sendOtpFromSender(
  creds: OtpCreds,
  phoneNumber: string,
  otpCode: string,
): Promise<WhatsAppSendResult & { attempts?: Array<{ label: string; error?: string; statusCode?: number }> }> {
  let selectedTemplate: MetaOtpTemplate | null = null;
  let selectedTemplateName = 'otp';

  for (const templateName of OTP_TEMPLATE_NAMES) {
    const templates = await fetchMetaTemplatesByName(creds, templateName);
    const best = pickBestOtpTemplate(templates);
    if (best) {
      selectedTemplate = best;
      selectedTemplateName = templateName;
      break;
    }
  }

  if (!selectedTemplate) {
    const direct = await sendAttempt(creds, phoneNumber, 'otp', {
      label: 'otp-url',
      languageCode: 'en',
      components: [
        { type: 'body', parameters: [{ type: 'text', text: otpCode }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otpCode }] },
      ],
    });
    if (direct.success) return tagSender(creds, direct);
    return tagSender(creds, {
      success: false,
      error: direct.error || 'WhatsApp OTP template "otp" is not on this number.',
      statusCode: direct.statusCode,
      raw: direct.raw,
    });
  }

  const metaStatus = String(selectedTemplate.status || '').toUpperCase();
  if (metaStatus !== 'APPROVED') {
    return tagSender(creds, {
      success: false,
      error: `WhatsApp OTP template is ${metaStatus || 'NOT APPROVED'} on this number.`,
      raw: selectedTemplate,
    });
  }

  const attempts = buildAttemptsForTemplate(selectedTemplate, otpCode);
  const attemptErrors: Array<{ label: string; error?: string; statusCode?: number }> = [];
  let lastResult: WhatsAppSendResult = { success: false, error: 'Unknown WhatsApp error' };

  for (const attempt of attempts) {
    const result = await sendAttempt(creds, phoneNumber, selectedTemplateName, attempt);
    if (result.success) return tagSender(creds, result);
    lastResult = result;
    attemptErrors.push({
      label: attempt.label,
      error: result.error,
      statusCode: result.statusCode,
    });
  }

  return tagSender(creds, {
    ...lastResult,
    attempts: attemptErrors,
    error:
      lastResult.error ||
      'Failed to send OTP on WhatsApp. Check that template "otp" matches Meta (AUTHENTICATION/body/button).',
  });
}

function tagSender(creds: OtpCreds, result: OtpSendResult): OtpSendResult {
  return { ...result, senderPhoneNumberId: creds.whatsapp_phone_number_id };
}

export async function stampWhatsAppOtpRequest(
  id: string,
  metadata: Record<string, unknown>,
  result: OtpSendResult,
) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin || !id) return;
  const next = {
    ...metadata,
    whatsapp_phone_number_id: result.senderPhoneNumberId || null,
    whatsapp_message_id: result.messageId || null,
    whatsapp_tried_phone_number_ids: result.triedPhoneNumberIds || (result.senderPhoneNumberId ? [result.senderPhoneNumberId] : []),
  };
  if (!result.success) {
    Object.assign(next, {
      whatsapp_error: String(result.error || 'Unknown WhatsApp error').slice(0, 240),
      whatsapp_status_code: result.statusCode || null,
    });
  }
  await supabaseAdmin
    .from('otp_requests')
    .update({ status: result.success ? 'SENT' : 'FAILED', metadata: next })
    .eq('id', id);
}

export async function sendWhatsAppOtpMessage(
  phoneNumber: string,
  otpCode: string,
): Promise<OtpSendResult> {
  const channels = await loadOtpChannelConfig();
  if (!channels.whatsapp) {
    return { success: false, error: 'WhatsApp OTP is turned off.' };
  }
  const senders = await loadOtpSenders();
  if (!senders.length) {
    return { success: false, error: 'WhatsApp API credentials are not configured' };
  }

  const ranked = await Promise.all(
    senders.map(async (sender) => ({ sender, health: await readSenderHealth(sender) })),
  );
  ranked.sort((a, b) => {
    const score = (row: { sender: OtpCreds; health: SenderHealth }) =>
      (row.health === 'healthy' ? 0 : row.health === 'unknown' ? 1 : 2) * 10 + (row.sender.preferred ? 0 : 1);
    return score(a) - score(b);
  });
  const usable = ranked.filter((row) => row.health !== 'down');
  const queue = usable.length ? usable : ranked;

  const attemptErrors: Array<{ label: string; error?: string; statusCode?: number }> = [];
  const triedPhoneNumberIds: string[] = [];
  let lastResult: OtpSendResult = { success: false, error: 'Unknown WhatsApp error' };

  for (const row of queue) {
    const result = await sendOtpFromSender(row.sender, phoneNumber, otpCode);
    const senderId = result.senderPhoneNumberId || row.sender.whatsapp_phone_number_id;
    if (senderId && !triedPhoneNumberIds.includes(senderId)) triedPhoneNumberIds.push(senderId);
    if (result.success) {
      try {
        const { supabaseAdmin } = getSupabaseAdmin();
        if (supabaseAdmin && senderId) {
          await archiveSentOtpMessage(supabaseAdmin, {
            phoneNumberId: senderId,
            recipientPhone: phoneNumber,
            messageId: result.messageId,
          });
        }
      } catch (archiveError) {
        console.warn('[whatsapp-otp] chat archive skipped', archiveError);
      }
      return { ...result, senderPhoneNumberId: senderId, triedPhoneNumberIds };
    }
    lastResult = { ...result, senderPhoneNumberId: senderId, triedPhoneNumberIds: [...triedPhoneNumberIds] };
    attemptErrors.push(...(result.attempts || [{ label: 'otp', error: result.error, statusCode: result.statusCode }]));
    if (!shouldTryNextAccount(result)) break;
  }

  return {
    ...lastResult,
    attempts: attemptErrors,
    triedPhoneNumberIds,
    error: lastResult.error || 'Failed to send OTP on WhatsApp.',
  };
}
