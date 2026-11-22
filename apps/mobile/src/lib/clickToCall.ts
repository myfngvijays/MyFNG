import { Alert } from 'react-native';
import { apiFetch } from './api';
import { placePhoneCall } from './phone';

function normalizePhone10(raw: unknown): string | null {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length >= 10) return d.slice(-10);
  if (d.length >= 8) return d;
  return null;
}

/**
 * Dial the customer from this phone's SIM, then save the call on the lead.
 * A website Call button does not use this path — the server pushes SIM_DIAL here.
 */
export async function clickToCallCustomer(opts: {
  customerPhone: string | null | undefined;
  leadId?: string | null;
  customerName?: string | null;
  leadNumber?: string | null;
  place?: string | null;
  fallbackToDialer?: boolean;
  /** When true, skip success Alert — caller shows its own UI (e.g. Dialer ringing sheet). */
  silent?: boolean;
}): Promise<{ ok: boolean; error?: string; message?: string; code?: string; sessionId?: string }> {
  const to = normalizePhone10(opts.customerPhone);
  if (!to) {
    Alert.alert('Call', 'Customer phone missing');
    return { ok: false, error: 'Customer phone missing' };
  }

  await placePhoneCall(to);

  try {
    await apiFetch('/api/telecaller/click-to-call', {
      method: 'POST',
      body: JSON.stringify({
        to,
        lead_id: opts.leadId || undefined,
        customer_name: opts.customerName || undefined,
        source: 'device',
      }),
    });
  } catch {
    // The dialer is already open. A missed log should not block the call.
  }

  if (!opts.silent) {
    Alert.alert('Calling', `Opening your phone dialer for ${to}`);
  }
  return { ok: true, message: 'Opening your phone dialer' };
}
