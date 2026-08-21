/** WhatsApp 24h customer-care window (free-form vs template-only). */

export const WA_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

export type WaSessionChatFields = {
  last_inbound_at?: string | null;
  last_direction?: string | null;
  last_message_at?: string | null;
};

/**
 * True when normal chat is closed — only templates can be sent.
 * Uses last_inbound_at only (do not treat lead updated_at as inbound).
 */
export function isWhatsAppSessionWindowClosed(chat: WaSessionChatFields): boolean {
  const inboundRaw = String(chat.last_inbound_at || '').trim();
  if (!inboundRaw) return true;
  const inboundMs = new Date(inboundRaw).getTime();
  if (!Number.isFinite(inboundMs)) return true;
  return Date.now() - inboundMs > WA_SESSION_WINDOW_MS;
}
