import { Alert } from 'react-native';
import { apiFetch } from './api';
import { openPhoneCall } from './phone';

function normalizePhone10(raw: unknown): string | null {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length >= 10) return d.slice(-10);
  if (d.length >= 8) return d;
  return null;
}

/**
 * Smartflo click-to-call via Next API → Supabase edge gateway.
 * Falls back to native dialer if agent phone missing or gateway fails (optional).
 */
export async function clickToCallCustomer(opts: {
  customerPhone: string | null | undefined;
  leadId?: string | null;
  fallbackToDialer?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const to = normalizePhone10(opts.customerPhone);
  if (!to) {
    Alert.alert('Call', 'Customer phone missing');
    return { ok: false, error: 'Customer phone missing' };
  }

  try {
    const json = await apiFetch<{
      success?: boolean;
      error?: string;
      code?: string;
      message?: string;
    }>('/api/telecaller/click-to-call', {
      method: 'POST',
      body: JSON.stringify({
        to,
        lead_id: opts.leadId || undefined,
      }),
    });

    if ((json as any)?.error && !(json as any)?.success) {
      throw Object.assign(new Error(String((json as any).error)), {
        code: (json as any).code,
      });
    }

    Alert.alert(
      'Calling…',
      String(
        (json as any)?.message ||
          'Answer your phone first — customer will be connected after you pick up.',
      ),
    );
    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.message || 'Click-to-call failed');
    const missingAgent = e?.code === 'MISSING_AGENT_PHONE' || /from|agent phone|calling number/i.test(msg);

    if (opts.fallbackToDialer !== false) {
      Alert.alert(
        'Click-to-call failed',
        missingAgent
          ? `${msg}\n\nOpening phone dialer instead.`
          : `${msg}\n\nOpening phone dialer instead.`,
        [
          {
            text: 'OK',
            onPress: () => {
              void openPhoneCall(to);
            },
          },
        ],
      );
      return { ok: false, error: msg };
    }

    Alert.alert('Call failed', msg);
    return { ok: false, error: msg };
  }
}
