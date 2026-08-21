/**
 * Click-to-call via the configured gateway URL only
 * (e.g. Supabase edge `click-to-call-gateway?from=&to=&did=&provider=`).
 *
 * Same URL for:
 * - Manual Call button
 * - Auto-dial when a Fresh lead is assigned
 *
 * Gateway itself rings telecaller (`from`) first, then customer (`to`).
 */

import {
  getClickToCallConfig,
  resolveDidForTelecaller,
  type ClickToCallConfig,
} from '@/lib/telecaller/clickToCallConfig';

export type ClickToCallDialResult = {
  ok: boolean;
  error?: string;
  status?: number;
  from?: string;
  to?: string;
  did?: string;
  provider?: string;
  via?: 'gateway';
  upstream?: unknown;
  url?: string;
};

function digitsOnly(raw: unknown): string {
  return String(raw || '').replace(/\D/g, '');
}

export function normalizePhone10(raw: unknown): string | null {
  const d = digitsOnly(raw);
  if (!d) return null;
  if (d.length >= 10) return d.slice(-10);
  if (d.length >= 8) return d;
  return null;
}

async function hitGatewayUrl(input: {
  cfg: ClickToCallConfig;
  from10: string;
  to10: string;
  did: string;
}): Promise<ClickToCallDialResult> {
  const url = new URL(input.cfg.gateway_url);
  url.searchParams.set('from', input.from10);
  url.searchParams.set('to', input.to10);
  url.searchParams.set('did', input.did);
  url.searchParams.set('provider', input.cfg.provider || 'smartflo');

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (input.cfg.gateway_key) {
    headers.Authorization = `Bearer ${input.cfg.gateway_key}`;
  }

  const upstream = await fetch(url.toString(), {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  const text = await upstream.text().catch(() => '');
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      error:
        (json && (json.error || json.message)) ||
        text ||
        `Click-to-call gateway failed (${upstream.status})`,
      from: input.from10,
      to: input.to10,
      did: input.did,
      provider: input.cfg.provider,
      via: 'gateway',
      url: url.toString(),
      upstream: json || { raw: text },
    };
  }

  return {
    ok: true,
    from: input.from10,
    to: input.to10,
    did: input.did,
    provider: input.cfg.provider,
    via: 'gateway',
    url: url.toString(),
    upstream: json || { raw: text || 'ok' },
  };
}

/** Manual Call + Fresh auto-dial — always the same gateway URL hit. */
export async function initiateClickToCall(input: {
  to: string;
  from: string;
  telecallerId?: string | null;
  did?: string | null;
  cfg?: ClickToCallConfig;
}): Promise<ClickToCallDialResult> {
  const to10 = normalizePhone10(input.to);
  const from10 = normalizePhone10(input.from);
  if (!to10) return { ok: false, error: 'Customer phone (to) required' };
  if (!from10) {
    return {
      ok: false,
      error:
        'Your calling number (from) is missing. Set telecaller phone in Click to Call setup.',
    };
  }

  const cfg = input.cfg || (await getClickToCallConfig());
  if (!cfg.enabled) {
    return { ok: false, error: 'Click-to-call is disabled', status: 503 };
  }

  const did =
    digitsOnly(input.did) ||
    resolveDidForTelecaller(cfg, input.telecallerId) ||
    digitsOnly(cfg.did);

  return hitGatewayUrl({ cfg, from10, to10, did });
}

/**
 * Same gateway URL as Call button — when Fresh/NEW lead is assigned
 * and Auto-dial Fresh is ON.
 */
export async function autoDialFreshLeadIfEnabled(input: {
  leadId?: string | null;
  customerPhone?: string | null;
  telecallerId?: string | null;
  leadStatus?: string | null;
}): Promise<ClickToCallDialResult | { ok: false; skipped: true; reason: string }> {
  const cfg = await getClickToCallConfig();
  if (!cfg.enabled || !cfg.auto_dial_on_fresh_assign) {
    return { ok: false, skipped: true, reason: 'auto_dial_on_fresh_assign off' };
  }

  const status = String(input.leadStatus || 'NEW').toUpperCase();
  const isFresh =
    !status ||
    status === 'NEW' ||
    status === 'FRESH' ||
    status === 'ASSIGNED' ||
    status.includes('FRESH');
  if (!isFresh) {
    return { ok: false, skipped: true, reason: `status ${status} not fresh` };
  }

  const telecallerId = String(input.telecallerId || '').trim();
  const to = normalizePhone10(input.customerPhone);
  if (!telecallerId || !to) {
    return { ok: false, skipped: true, reason: 'missing telecaller or customer phone' };
  }

  const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { ok: false, skipped: true, reason: 'no admin client' };
  }

  const { data: agent } = await supabaseAdmin
    .from('users_login')
    .select('id, phone')
    .eq('id', telecallerId)
    .maybeSingle();

  const from = normalizePhone10((agent as any)?.phone);
  if (!from) {
    return { ok: false, skipped: true, reason: 'telecaller phone missing' };
  }

  return initiateClickToCall({
    to,
    from,
    telecallerId,
    cfg,
  });
}
