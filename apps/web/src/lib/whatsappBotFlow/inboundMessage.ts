export type WhatsAppInboundPayload = {
  type?: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string; description?: string };
  };
};

export function extractInboundBrainText(inbound: WhatsAppInboundPayload): string | null {
  const type = String(inbound?.type || '').trim().toLowerCase();

  if (type === 'text') {
    return String(inbound?.text?.body || '').trim() || null;
  }

  if (type === 'button') {
    const button = inbound?.button || {};
    return String(button.text || button.payload || '').trim() || null;
  }

  if (type === 'interactive') {
    const interactive = inbound?.interactive || {};
    if (interactive.type === 'button_reply') {
      const reply = interactive.button_reply || {};
      return String(reply.title || reply.id || '').trim() || null;
    }
    if (interactive.type === 'list_reply') {
      const reply = interactive.list_reply || {};
      const title = String(reply.title || '').trim();
      const description = String(reply.description || '').trim();
      const id = String(reply.id || '').trim();
      return [title, description, id].filter(Boolean).join(' · ') || null;
    }
  }

  return null;
}

export function isBrainEligibleInboundType(messageType: string): boolean {
  const type = String(messageType || '').trim().toLowerCase();
  return type === 'text' || type === 'button' || type === 'interactive';
}
