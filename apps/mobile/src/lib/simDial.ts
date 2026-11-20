import { openPhoneCall } from './phone';
import { requestOpenCrmLead } from '../components/telecaller/IncomingCallLeadOverlay';

let lastKey = '';
let lastAt = 0;

export function phoneFromDialPush(data?: Record<string, unknown> | null): string {
  return String(data?.phone || data?.to || '').replace(/\D/g, '').slice(-10);
}

async function ackDial(callLogId: string) {
  try {
    const { apiFetch } = require('./api') as typeof import('./api');
    await apiFetch('/api/telecaller/phone-dial', {
      method: 'POST',
      body: JSON.stringify({ id: callLogId, action: 'ack' }),
    });
  } catch {
    // The dialer is already opening. A missed ack should not block it.
  }
}

/**
 * Web clicked Call. Open that lead behind the system call sheet, then ask
 * iOS which line to use (Personal / business).
 */
export async function handleSimDialPush(data?: Record<string, unknown> | null): Promise<void> {
  const phone = phoneFromDialPush(data);
  if (phone.length < 8) return;
  const leadId = String(data?.lead_id || '').trim();
  const callLogId = String(data?.call_log_id || '').trim();
  const key = callLogId || `${phone}:${leadId}`;
  const now = Date.now();
  if (key === lastKey && now - lastAt < 20000) {
    if (callLogId) void ackDial(callLogId);
    return;
  }
  lastKey = key;
  lastAt = now;
  if (leadId) requestOpenCrmLead(leadId);
  await new Promise((resolve) => setTimeout(resolve, 150));
  await openPhoneCall(phone);
  if (callLogId) await ackDial(callLogId);
}
