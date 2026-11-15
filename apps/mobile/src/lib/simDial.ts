import { openPhoneCall } from './phone';

let lastKey = '';
let lastAt = 0;

export function phoneFromDialPush(data?: Record<string, unknown> | null): string {
  return String(data?.phone || data?.to || '').replace(/\D/g, '').slice(-10);
}

/** Open this phone's dialer for a web-initiated call. Ignores a repeat of the same number for a few seconds. */
export async function handleSimDialPush(data?: Record<string, unknown> | null): Promise<void> {
  const phone = phoneFromDialPush(data);
  if (phone.length < 8) return;
  const key = `${phone}:${String(data?.lead_id || '')}`;
  const now = Date.now();
  if (key === lastKey && now - lastAt < 8000) return;
  lastKey = key;
  lastAt = now;
  await openPhoneCall(phone);
}
