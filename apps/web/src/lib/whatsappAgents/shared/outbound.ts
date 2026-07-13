import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  normalizePhoneNumber,
  sendTextMessage,
  type WhatsAppSendResult,
} from '@/lib/services/whatsappService';

export async function sendAgentTextMessage(input: {
  phone: string;
  message: string;
  source: string;
  meta?: Record<string, unknown>;
}): Promise<WhatsAppSendResult> {
  const phone = normalizePhoneNumber(input.phone);
  const message = String(input.message || '').trim();
  if (!phone || !message) return { success: false, error: 'Invalid phone or message' };

  const result = await sendTextMessage(phone, message);

  if (!input.meta?.dryRun) {
    await archiveAgentOutboundMessage({
      phone,
      text: message,
      sendResult: result,
      source: input.source,
      meta: input.meta,
    });
  }

  return result;
}

export async function archiveAgentOutboundMessage(input: {
  phone: string;
  text: string;
  sendResult: WhatsAppSendResult;
  source: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  const now = new Date().toISOString();
  await supabaseAdmin.from('whatsapp_messages').insert({
    provider_message_id: input.sendResult.messageId || null,
    direction: 'OUTBOUND',
    message_type: 'TEXT',
    sender_phone: null,
    recipient_phone: normalizePhoneNumber(input.phone),
    text_body: input.text,
    status: input.sendResult.success ? 'SENT' : 'FAILED',
    status_at: now,
    error_message: input.sendResult.success ? null : input.sendResult.error || 'Agent send failed',
    payload: { source: input.source, response: input.sendResult.raw || null },
    meta: { agent_auto_reply: true, source: input.source, ...(input.meta || {}) },
    updated_at: now,
  });
}
