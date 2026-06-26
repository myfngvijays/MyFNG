type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
};

type ExpoPushTicket = {
  status?: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string; [key: string]: unknown };
};

export type ExpoPushDeliveryResult = {
  ok: boolean;
  attempted: number;
  delivered: number;
  failed: number;
  tickets: ExpoPushTicket[];
  errors: string[];
  raw?: string;
};

function isExpoPushToken(token: string) {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

function parseExpoTickets(raw: string): ExpoPushTicket[] {
  try {
    const json = JSON.parse(raw);
    if (Array.isArray(json?.data)) return json.data as ExpoPushTicket[];
    if (Array.isArray(json)) return json as ExpoPushTicket[];
  } catch {
    // ignore
  }
  return [];
}

export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<ExpoPushDeliveryResult> {
  const payload = messages.filter((m) => typeof m.to === 'string' && isExpoPushToken(m.to));
  if (payload.length === 0) {
    return { ok: true, attempted: 0, delivered: 0, failed: 0, tickets: [], errors: [] };
  }

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Expo push send failed (${res.status}): ${text}`);
  }

  const tickets = parseExpoTickets(text);
  const errors: string[] = [];
  let delivered = 0;
  let failed = 0;

  for (const ticket of tickets) {
    if (ticket.status === 'ok') {
      delivered += 1;
      continue;
    }
    failed += 1;
    const detail = ticket.details?.error || ticket.message || 'unknown_error';
    errors.push(String(detail));
  }

  // Fallback when Expo returns 200 without per-ticket data (legacy behaviour).
  if (tickets.length === 0) {
    delivered = payload.length;
  }

  return {
    ok: failed === 0,
    attempted: payload.length,
    delivered,
    failed: tickets.length > 0 ? failed : 0,
    tickets,
    errors: [...new Set(errors)],
    raw: text,
  };
}
