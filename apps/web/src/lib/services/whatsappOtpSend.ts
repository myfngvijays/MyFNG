/**
 * Sends the WhatsApp OTP template using the live Meta template definition
 * so body/button parameters match after WABA migration or repush.
 */

import {
  getResolvedWhatsAppAgentsCredentials,
  type ResolvedWhatsAppAgentsCredentials,
} from '@/lib/whatsappAgents/shared/envConfigStore';
import type { WhatsAppSendResult } from '@/lib/services/whatsappService';
import { normalizePhoneNumber } from '@/lib/services/whatsappService';

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
  creds: ResolvedWhatsAppAgentsCredentials,
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
  creds: ResolvedWhatsAppAgentsCredentials,
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

export async function sendWhatsAppOtpMessage(
  phoneNumber: string,
  otpCode: string,
): Promise<WhatsAppSendResult & { attempts?: Array<{ label: string; error?: string; statusCode?: number }> }> {
  const creds = await getResolvedWhatsAppAgentsCredentials(true);
  if (!creds.whatsapp_access_token?.trim() || !creds.whatsapp_phone_number_id?.trim()) {
    return { success: false, error: 'WhatsApp API credentials are not configured' };
  }

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
    return {
      success: false,
      error:
        'WhatsApp OTP template "otp" not found on this WABA. Open WhatsApp Templates → Repush all, then wait for Meta approval.',
    };
  }

  const metaStatus = String(selectedTemplate.status || '').toUpperCase();
  if (metaStatus !== 'APPROVED') {
    return {
      success: false,
      error: `WhatsApp OTP template is ${metaStatus || 'NOT APPROVED'} on WABA ${creds.whatsapp_business_account_id}. Meta approval is required before OTP can be sent.`,
      raw: selectedTemplate,
    };
  }

  const attempts = buildAttemptsForTemplate(selectedTemplate, otpCode);
  const attemptErrors: Array<{ label: string; error?: string; statusCode?: number }> = [];
  let lastResult: WhatsAppSendResult = { success: false, error: 'Unknown WhatsApp error' };

  for (const attempt of attempts) {
    const result = await sendAttempt(creds, phoneNumber, selectedTemplateName, attempt);
    if (result.success) {
      return result;
    }
    lastResult = result;
    attemptErrors.push({
      label: attempt.label,
      error: result.error,
      statusCode: result.statusCode,
    });
  }

  return {
    ...lastResult,
    attempts: attemptErrors,
    error:
      lastResult.error ||
      'Failed to send OTP on WhatsApp. Check that template "otp" matches Meta (AUTHENTICATION/body/button).',
  };
}
