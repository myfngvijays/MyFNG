import {
  isSessionOpenForPhone,
  sendBrainOutboundMessage,
} from '@/lib/whatsappBotFlow/sessionWindow';
import { fetchWhatsAppBrainConfig } from '@/lib/whatsappBotFlow/brainConfig';
import {
  normalizePhoneNumber,
  sendTemplateMessage,
  sendTextMessage,
  type WhatsAppSendResult,
} from '@/lib/services/whatsappService';
import { archiveAgentOutboundMessage } from './outbound';
import type { AgentConfig } from './types';

export async function sendAgentOutboundMessage(input: {
  phone: string;
  message: string;
  config: AgentConfig;
  source: string;
  inboundAt?: string | null;
  dryRun?: boolean;
  meta?: Record<string, unknown>;
}): Promise<WhatsAppSendResult & { usedTemplate?: boolean; sessionOpen?: boolean }> {
  const phone = normalizePhoneNumber(input.phone);
  const message = String(input.message || '').trim();
  if (!phone || !message) return { success: false, error: 'Invalid phone or message' };
  if (input.dryRun) return { success: true, sessionOpen: true, usedTemplate: false };

  const triggers = input.config.triggers_json as Record<string, unknown>;
  const templateName = String(triggers.outbound_template_name || '').trim();
  const templateLanguage = String(triggers.outbound_template_language || 'en').trim();

  const sessionOpen = await isSessionOpenForPhone(phone, { inboundAt: input.inboundAt });

  if (sessionOpen) {
    const textResult = await sendTextMessage(phone, message);
    if (textResult.success) {
      await archiveAgentOutboundMessage({
        phone,
        text: message,
        sendResult: textResult,
        source: input.source,
        meta: input.meta,
      });
      return { ...textResult, usedTemplate: false, sessionOpen: true };
    }
  }

  if (templateName) {
    const customerName =
      String(input.meta?.customer_name || input.meta?.customerName || 'there').trim() || 'there';
    const templateResult = await sendTemplateMessage({
      phoneNumber: phone,
      templateName,
      templateParams: [customerName.slice(0, 50)],
      languageCode: templateLanguage,
    });
    if (templateResult.success) {
      await archiveAgentOutboundMessage({
        phone,
        text: message,
        sendResult: templateResult,
        source: input.source,
        meta: { ...input.meta, used_template: true },
      });
    }
    return { ...templateResult, usedTemplate: templateResult.success, sessionOpen };
  }

  // Fallback: reuse brain reopen template if configured
  const brainConfig = await fetchWhatsAppBrainConfig();
  if (brainConfig.reopen_template_name) {
    const brainSend = await sendBrainOutboundMessage({
      phone,
      message,
      config: brainConfig,
      inboundAt: input.inboundAt,
    });
    if (brainSend.success) {
      await archiveAgentOutboundMessage({
        phone,
        text: message,
        sendResult: brainSend,
        source: input.source,
        meta: { ...input.meta, used_brain_template: true },
      });
    }
    return brainSend;
  }

  return {
    success: false,
    error: 'WhatsApp session closed and no outbound template configured',
    sessionOpen,
    usedTemplate: false,
  };
}
