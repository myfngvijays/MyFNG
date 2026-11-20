/**
 * Shared click-to-call helpers (browser + isomorphic).
 * Server proxy: POST /api/telecaller/click-to-call
 */

export function normalizeClickToCallPhone(raw: unknown): string | null {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length >= 10) return d.slice(-10);
  if (d.length >= 8) return d;
  return null;
}

export type ClickToCallResult = {
  ok: boolean;
  error?: string;
  code?: string;
  from?: string;
  to?: string;
  message?: string;
  sessionId?: string;
  callLogId?: string;
};

export const PHONE_DIAL_EVENT = 'myfng:phone-dial';
export const PHONE_DIAL_MS = 40_000;

export function announcePhoneDial(detail: { callLogId?: string; phone: string }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(PHONE_DIAL_EVENT, {
      detail: { ...detail, startedAt: Date.now() },
    }),
  );
}

export async function requestClickToCall(input: {
  to: string;
  from?: string | null;
  leadId?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<ClickToCallResult> {
  const to = normalizeClickToCallPhone(input.to);
  if (!to) return { ok: false, error: 'Invalid customer phone' };

  const fetchFn = input.fetchImpl || fetch;
  try {
    const res = await fetchFn('/api/telecaller/click-to-call', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        from: input.from ? normalizeClickToCallPhone(input.from) : undefined,
        lead_id: input.leadId || undefined,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: String(json?.error || 'Click-to-call failed'),
        code: json?.code ? String(json.code) : undefined,
      };
    }
    const callLogId = json?.call_log_id ? String(json.call_log_id) : undefined;
    announcePhoneDial({ callLogId, phone: json?.to ? String(json.to) : to });
    return {
      ok: true,
      from: json?.from ? String(json.from) : undefined,
      to: json?.to ? String(json.to) : to,
      message: String(json?.message || 'Call initiated'),
      sessionId: json?.session_id ? String(json.session_id) : undefined,
      callLogId,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}
