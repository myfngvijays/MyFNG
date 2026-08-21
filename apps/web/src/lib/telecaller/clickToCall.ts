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
};

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
    return {
      ok: true,
      from: json?.from ? String(json.from) : undefined,
      to: json?.to ? String(json.to) : to,
      message: String(json?.message || 'Call initiated'),
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}
