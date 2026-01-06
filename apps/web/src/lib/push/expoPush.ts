type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
};

function isExpoPushToken(token: string) {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

export async function sendExpoPush(messages: ExpoPushMessage[]) {
  const payload = messages.filter((m) => typeof m.to === 'string' && isExpoPushToken(m.to));
  if (payload.length === 0) return { ok: true, sent: 0 };

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // Expo returns JSON like: { data: [{ status: 'ok'|'error', ...}] }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Expo push send failed (${res.status}): ${text}`);
  }
  return { ok: true, sent: payload.length, raw: text };
}


