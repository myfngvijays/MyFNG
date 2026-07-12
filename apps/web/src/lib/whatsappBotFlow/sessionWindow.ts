import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  normalizePhoneNumber,
  sendTemplateMessage,
  sendTextMessage,
  type WhatsAppSendResult,
} from '@/lib/services/whatsappService';
import type { WhatsAppBrainConfig } from './brainConfig';

const DEFAULT_WINDOW_HOURS = 24;

export async function getLastCustomerInboundAt(phone: string): Promise<string | null> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  const normalized = normalizePhoneNumber(phone);
  const { data } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('status_at, created_at')
    .eq('direction', 'INBOUND')
    .eq('sender_phone', normalized)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return String(data?.status_at || data?.created_at || '').trim() || null;
}

export function isWithinWhatsAppSessionWindow(
  lastInboundAt: string | null | undefined,
  windowHours = DEFAULT_WINDOW_HOURS,
): boolean {
  if (!lastInboundAt) return false;
  const ts = new Date(lastInboundAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= windowHours * 60 * 60 * 1000;
}

export async function isSessionOpenForPhone(
  phone: string,
  opts?: { inboundAt?: string | null; windowHours?: number },
): Promise<boolean> {
  const windowHours = opts?.windowHours ?? DEFAULT_WINDOW_HOURS;
  if (opts?.inboundAt && isWithinWhatsAppSessionWindow(opts.inboundAt, windowHours)) {
    return true;
  }
  const lastInboundAt = await getLastCustomerInboundAt(phone);
  return isWithinWhatsAppSessionWindow(lastInboundAt, windowHours);
}

function isTemplateRequiredError(error?: string): boolean {
  const text = String(error || '').toLowerCase();
  return (
    text.includes('template') ||
    text.includes('24 hour') ||
    text.includes('24-hour') ||
    text.includes('re-engagement') ||
    text.includes('131047') ||
    text.includes('131026')
  );
}

export async function sendBrainOutboundMessage(input: {
  phone: string;
  message: string;
  config: WhatsAppBrainConfig;
  inboundAt?: string | null;
}): Promise<WhatsAppSendResult & { usedTemplate?: boolean; sessionOpen?: boolean }> {
  const phone = normalizePhoneNumber(input.phone);
  const message = String(input.message || '').trim();
  if (!phone || !message) return { success: false, error: 'Invalid phone or message' };

  const windowHours = input.config.session_window_hours ?? DEFAULT_WINDOW_HOURS;
  const sessionOpen = await isSessionOpenForPhone(phone, {
    inboundAt: input.inboundAt,
    windowHours,
  });

  if (sessionOpen) {
    const textResult = await sendTextMessage(phone, message);
    if (textResult.success || !isTemplateRequiredError(textResult.error)) {
      return { ...textResult, usedTemplate: false, sessionOpen: true };
    }
  }

  const templateName = String(input.config.reopen_template_name || '').trim();
  if (!templateName) {
    return {
      success: false,
      error: sessionOpen
        ? 'Failed to send WhatsApp text reply'
        : 'WhatsApp 24-hour session window closed and no reopen template configured',
      sessionOpen,
      usedTemplate: false,
    };
  }

  const templateParams = (input.config.reopen_template_params || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  const templateResult = await sendTemplateMessage({
    phoneNumber: phone,
    templateName,
    templateParams: templateParams.length > 0 ? templateParams : [message.slice(0, 200)],
    languageCode: input.config.reopen_template_language || 'en',
  });

  return {
    ...templateResult,
    usedTemplate: templateResult.success,
    sessionOpen,
  };
}
