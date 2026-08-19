/**
 * WhatsApp Business Cloud API service
 * Server-only service used by API routes.
 */

import { getResolvedWhatsAppAgentsCredentials } from '@/lib/whatsappAgents/shared/envConfigStore';

export type WhatsAppSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
  raw?: unknown;
};

type TemplateBodyParam = { type: 'text'; text: string };

type MediaMessageInput = {
  phoneNumber: string;
  mediaType: 'image' | 'document' | 'video' | 'audio';
  mediaUrl?: string;
  mediaId?: string;
  caption?: string;
  filename?: string;
};

type TemplateMessageInput = {
  phoneNumber: string;
  templateName: string;
  templateParams?: string[];
  buttonUrlParams?: string[];
  languageCode?: string;
};

function assertWhatsAppConfig(creds: {
  whatsapp_phone_number_id: string;
  whatsapp_access_token: string;
}): string | null {
  if (!creds.whatsapp_phone_number_id) return 'WHATSAPP_PHONE_NUMBER_ID is not configured';
  if (!creds.whatsapp_access_token) return 'WHATSAPP_ACCESS_TOKEN is not configured';
  return null;
}

export function normalizePhoneNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  if (!digits) return '';
  const last10 = digits.slice(-10);
  if (last10.length === 10) return `91${last10}`;
  return digits;
}

async function parseCloudApiError(response: Response): Promise<{ message: string; raw?: unknown }> {
  try {
    const payload = await response.json();
    const message =
      payload?.error?.error_user_msg ||
      payload?.error?.message ||
      `WhatsApp API request failed (${response.status})`;
    return { message, raw: payload };
  } catch {
    return { message: `WhatsApp API request failed (${response.status})` };
  }
}

async function sendMessagePayload(payload: unknown): Promise<WhatsAppSendResult> {
  const creds = await getResolvedWhatsAppAgentsCredentials();
  const configError = assertWhatsAppConfig(creds);
  if (configError) {
    return { success: false, error: configError };
  }

  try {
    const response = await fetch(`${creds.whatsapp_api_url}/${creds.whatsapp_phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.whatsapp_access_token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const parsed = await parseCloudApiError(response);
      return {
        success: false,
        error: parsed.message,
        statusCode: response.status,
        raw: parsed.raw,
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data?.messages?.[0]?.id,
      statusCode: response.status,
      raw: data,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to call WhatsApp API' };
  }
}

export type WhatsAppReplyButton = {
  id: string;
  title: string;
};

export type WhatsAppListRow = {
  id: string;
  title: string;
  description?: string;
};

export type WhatsAppListSection = {
  title?: string;
  rows: WhatsAppListRow[];
};

export async function sendReplyButtonsMessage(input: {
  phoneNumber: string;
  body: string;
  buttons: WhatsAppReplyButton[];
  header?: string;
  footer?: string;
}): Promise<WhatsAppSendResult> {
  const to = normalizePhoneNumber(input.phoneNumber);
  if (!to) return { success: false, error: 'Invalid recipient phone number' };

  const buttons = (input.buttons || [])
    .map((btn) => ({
      type: 'reply' as const,
      reply: {
        id: String(btn.id || '').trim().slice(0, 256),
        title: String(btn.title || '').trim().slice(0, 20),
      },
    }))
    .filter((btn) => btn.reply.id && btn.reply.title)
    .slice(0, 3);

  if (!buttons.length) return { success: false, error: 'At least one reply button is required' };
  if (!input.body?.trim()) return { success: false, error: 'Message body is required' };

  return sendMessagePayload({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      header: input.header?.trim() ? { type: 'text', text: input.header.trim().slice(0, 60) } : undefined,
      body: { text: input.body.trim().slice(0, 1024) },
      footer: input.footer?.trim() ? { text: input.footer.trim().slice(0, 60) } : undefined,
      action: { buttons },
    },
  });
}

export async function sendListMessage(input: {
  phoneNumber: string;
  body: string;
  buttonLabel: string;
  sections: WhatsAppListSection[];
  header?: string;
  footer?: string;
}): Promise<WhatsAppSendResult> {
  const to = normalizePhoneNumber(input.phoneNumber);
  if (!to) return { success: false, error: 'Invalid recipient phone number' };
  if (!input.body?.trim()) return { success: false, error: 'Message body is required' };

  const sections = (input.sections || [])
    .map((section) => ({
      title: section.title?.trim().slice(0, 24) || undefined,
      rows: (section.rows || [])
        .map((row) => ({
          id: String(row.id || '').trim().slice(0, 200),
          title: String(row.title || '').trim().slice(0, 24),
          description: row.description?.trim().slice(0, 72) || undefined,
        }))
        .filter((row) => row.id && row.title)
        .slice(0, 10),
    }))
    .filter((section) => section.rows.length > 0)
    .slice(0, 10);

  const rowCount = sections.reduce((sum, section) => sum + section.rows.length, 0);
  if (!rowCount) return { success: false, error: 'List message requires at least one row' };

  return sendMessagePayload({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: input.header?.trim() ? { type: 'text', text: input.header.trim().slice(0, 60) } : undefined,
      body: { text: input.body.trim().slice(0, 1024) },
      footer: input.footer?.trim() ? { text: input.footer.trim().slice(0, 60) } : undefined,
      action: {
        button: String(input.buttonLabel || 'View options').trim().slice(0, 20),
        sections,
      },
    },
  });
}

export async function sendTextMessage(phoneNumber: string, message: string): Promise<WhatsAppSendResult> {
  const to = normalizePhoneNumber(phoneNumber);
  if (!to) return { success: false, error: 'Invalid recipient phone number' };
  if (!message?.trim()) return { success: false, error: 'Message body is required' };

  return sendMessagePayload({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: message.trim() },
  });
}

export async function sendMediaMessage(input: MediaMessageInput): Promise<WhatsAppSendResult> {
  const to = normalizePhoneNumber(input.phoneNumber);
  if (!to) return { success: false, error: 'Invalid recipient phone number' };
  const mediaUrl = String(input.mediaUrl || '').trim();
  const mediaId = String(input.mediaId || '').trim();
  if (!mediaUrl && !mediaId) {
    return { success: false, error: 'Media URL or media ID is required' };
  }

  if (input.mediaType === 'image') {
    return sendMessagePayload({
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: {
        ...(mediaId ? { id: mediaId } : { link: mediaUrl }),
        caption: input.caption?.trim() || undefined,
      },
    });
  }

  if (input.mediaType === 'video') {
    return sendMessagePayload({
      messaging_product: 'whatsapp',
      to,
      type: 'video',
      video: {
        ...(mediaId ? { id: mediaId } : { link: mediaUrl }),
        caption: input.caption?.trim() || undefined,
      },
    });
  }

  if (input.mediaType === 'audio') {
    return sendMessagePayload({
      messaging_product: 'whatsapp',
      to,
      type: 'audio',
      audio: {
        ...(mediaId ? { id: mediaId } : { link: mediaUrl }),
      },
    });
  }

  return sendMessagePayload({
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: {
      ...(mediaId ? { id: mediaId } : { link: mediaUrl }),
      caption: input.caption?.trim() || undefined,
      filename: input.filename?.trim() || undefined,
    },
  });
}

export async function sendTemplateMessage(input: TemplateMessageInput): Promise<WhatsAppSendResult> {
  const to = normalizePhoneNumber(input.phoneNumber);
  if (!to) return { success: false, error: 'Invalid recipient phone number' };
  if (!input.templateName?.trim()) return { success: false, error: 'Template name is required' };

  const bodyParams = (input.templateParams || [])
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .map((text): TemplateBodyParam => ({ type: 'text', text }));

  const buttonParams = (input.buttonUrlParams || [])
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .map((text): TemplateBodyParam => ({ type: 'text', text }));

  const components: Array<Record<string, unknown>> = [];
  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams,
    });
  }
  if (buttonParams.length > 0) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: buttonParams,
    });
  }

  const primaryLanguage = String(input.languageCode || 'en').trim() || 'en';
  const languageFallbacks = Array.from(
    new Set(
      [primaryLanguage, primaryLanguage === 'en' ? 'en_US' : '', primaryLanguage === 'en_US' ? 'en' : ''].filter(
        Boolean,
      ),
    ),
  );

  let lastError: WhatsAppSendResult | null = null;
  for (const languageCode of languageFallbacks) {
    const result = await sendMessagePayload({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: input.templateName.trim(),
        language: { code: languageCode },
        components: components.length > 0 ? components : undefined,
      },
    });
    if (result.success) return result;
    lastError = result;
    const msg = String(result.error || '').toLowerCase();
    // Only retry alternate language when Meta complains about language / template match
    const languageIssue =
      msg.includes('language') ||
      msg.includes('template name') ||
      msg.includes('does not exist') ||
      msg.includes('translated');
    if (!languageIssue) break;
  }
  return lastError || { success: false, error: 'Failed to send template' };
}

/**
 * Backward-compatible wrapper used by existing invoice routes.
 */
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
  templateName?: string,
  templateParams?: string[]
): Promise<WhatsAppSendResult> {
  if (templateName) {
    return sendTemplateMessage({
      phoneNumber,
      templateName,
      templateParams,
      languageCode: 'en',
    });
  }
  return sendTextMessage(phoneNumber, message);
}

/**
 * Backward-compatible invoice helper used by billing flow.
 */
export async function sendInvoiceViaWhatsApp(
  phoneNumber: string,
  invoiceNumber: string,
  amount: number,
  invoiceLink: string,
  pdfUrl?: string
): Promise<WhatsAppSendResult> {
  const message =
    `Invoice ${invoiceNumber}\n\n` +
    `Amount: INR ${amount.toFixed(2)}\n\n` +
    `View & Pay: ${invoiceLink}\n\n` +
    'Thank you for your business.';

  if (pdfUrl) {
    return sendMediaMessage({
      phoneNumber,
      mediaType: 'document',
      mediaUrl: pdfUrl,
      filename: `Invoice-${invoiceNumber}.pdf`,
      caption: message,
    });
  }

  return sendTextMessage(phoneNumber, message);
}

/**
 * Legacy status method retained for compatibility.
 * WhatsApp Cloud API recommends webhook-driven status tracking.
 */
export async function checkWhatsAppMessageStatus(messageId: string): Promise<{
  status: string;
  delivered_at?: string;
  read_at?: string;
}> {
  const creds = await getResolvedWhatsAppAgentsCredentials();
  const configError = assertWhatsAppConfig(creds);
  if (configError) return { status: 'error' };

  try {
    const response = await fetch(`${creds.whatsapp_api_url}/${messageId}`, {
      headers: { Authorization: `Bearer ${creds.whatsapp_access_token}` },
    });
    if (!response.ok) return { status: 'error' };
    const data = await response.json();
    return {
      status: data?.status || 'unknown',
      delivered_at: data?.delivered_at,
      read_at: data?.read_at,
    };
  } catch {
    return { status: 'error' };
  }
}

