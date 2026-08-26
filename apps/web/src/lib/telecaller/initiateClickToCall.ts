/**
 * Click-to-call: prefer Smartflo direct API (fast async ACK), else gateway.
 *
 * Flow (agent_first): ring telecaller (`from`) first, then customer (`to`).
 * Same path for Manual Call + Auto-dial Fresh.
 */

import {
  getClickToCallConfig,
  resolveExclusiveDidForTelecaller,
  type ClickToCallConfig,
} from '@/lib/telecaller/clickToCallConfig';
import { evaluateAutoDialWindow } from '@/lib/telecaller/clickToCallHours';
import { SMARTFLO_API_BASE } from '@/lib/telecaller/smartfloCdr';

export type ClickToCallDialResult = {
  ok: boolean;
  error?: string;
  status?: number;
  from?: string;
  to?: string;
  did?: string;
  provider?: string;
  via?: 'smartflo' | 'gateway';
  upstream?: unknown;
  url?: string;
  /** Gateway still running after we returned — phone may ring shortly */
  pending?: boolean;
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

/** Smartflo usually wants 91XXXXXXXXXX */
function toE164In(raw10: string): string {
  const d = digitsOnly(raw10);
  if (d.startsWith('91') && d.length >= 12) return d;
  if (d.length === 10) return `91${d}`;
  return d;
}

function toCallerId(did: string): string {
  const d = digitsOnly(did);
  if (!d) return d;
  if (d.startsWith('91')) return d;
  if (d.length === 10) return `91${d}`;
  return d;
}

async function hitSmartfloDirect(input: {
  cfg: ClickToCallConfig;
  from10: string;
  to10: string;
  did: string;
}): Promise<ClickToCallDialResult> {
  const token = String(input.cfg.smartflo_api_token || '').trim();
  if (!token) {
    return { ok: false, error: 'Smartflo API token missing', status: 503 };
  }

  const url = `${SMARTFLO_API_BASE}/click_to_call`;
  const body = {
    agent_number: toE164In(input.from10),
    destination_number: toE164In(input.to10),
    caller_id: toCallerId(input.did),
    async: 1,
  };

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });

    const text = await upstream.text().catch(() => '');
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    const msg = String(json?.message || json?.error || text || '').trim();
    const successFlag =
      upstream.ok &&
      (json?.success === true ||
        json?.success === 'true' ||
        /success|accepted|ok|initiated/i.test(msg) ||
        Boolean(json?.ref_id || json?.call_id || json?.uuid) ||
        (!json?.error && upstream.status < 300));

    // Some Smartflo accounts return 200 with { success: false, message: "All providers failed" }
    if (!upstream.ok || json?.success === false || /providers?\s+failed/i.test(msg)) {
      return {
        ok: false,
        status: upstream.ok ? 502 : upstream.status,
        error: msg || `Smartflo click_to_call failed (${upstream.status})`,
        from: input.from10,
        to: input.to10,
        did: input.did,
        provider: input.cfg.provider,
        via: 'smartflo',
        url,
        upstream: json || { raw: text },
      };
    }

    if (!successFlag && msg && /fail|error|invalid|denied/i.test(msg)) {
      return {
        ok: false,
        status: 502,
        error: msg,
        from: input.from10,
        to: input.to10,
        did: input.did,
        provider: input.cfg.provider,
        via: 'smartflo',
        url,
        upstream: json || { raw: text },
      };
    }

    return {
      ok: true,
      from: input.from10,
      to: input.to10,
      did: input.did,
      provider: input.cfg.provider,
      via: 'smartflo',
      url,
      upstream: json || { raw: text || 'ok' },
    };
  } catch (e: any) {
    const timedOut =
      e?.name === 'TimeoutError' ||
      e?.name === 'AbortError' ||
      /aborted|timeout/i.test(String(e?.message || ''));
    return {
      ok: false,
      status: timedOut ? 504 : 502,
      error: timedOut
        ? 'Smartflo API timed out'
        : String(e?.message || 'Smartflo click_to_call error'),
      from: input.from10,
      to: input.to10,
      did: input.did,
      provider: input.cfg.provider,
      via: 'smartflo',
      url,
    };
  }
}

function explainDialFailure(json: any, from10: string, fallback: string): string {
  const nested = String(
    json?.last_error?.message ||
      json?.attempts?.[0]?.raw?.message ||
      json?.attempts?.[0]?.reason ||
      json?.error ||
      json?.message ||
      fallback ||
      '',
  ).trim();

  if (/missed by agent/i.test(nested)) {
    return `Smartflo ne aapke number (${from10}) pe ring try kiya, lekin pick nahi hua (Call missed by agent). Phone silent/DND/offline to nahi? Click to Call setup mein yahi number save hai na verify karo.`;
  }
  if (/providers?\s+failed/i.test(nested) || /providers?\s+failed/i.test(String(json?.error || ''))) {
    return nested.includes('missed by agent')
      ? nested
      : `${nested || 'All providers failed'} — aksar agent phone unreachable / galat number hota hai (${from10}).`;
  }
  return nested || fallback || 'Click-to-call failed';
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

  // Gateway often takes 15–25s (Smartflo rings agent, then ACK).
  // Never soft-ACK early and never abort mid-flight — that hid "Call missed by agent".
  try {
    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(28_000),
    });

    const text = await upstream.text().catch(() => '');
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    const failedExplicit =
      !upstream.ok ||
      json?.success === false ||
      /providers?\s+failed|missed by agent/i.test(
        String(json?.error || json?.message || json?.last_error?.message || ''),
      );

    if (failedExplicit) {
      return {
        ok: false,
        status: upstream.ok ? 502 : upstream.status || 502,
        error: explainDialFailure(
          json,
          input.from10,
          text || `Click-to-call gateway failed (${upstream.status})`,
        ),
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
  } catch (e: any) {
    const timedOut =
      e?.name === 'TimeoutError' ||
      e?.name === 'AbortError' ||
      /aborted|timeout/i.test(String(e?.message || ''));
    return {
      ok: false,
      status: timedOut ? 504 : 502,
      error: timedOut
        ? `Gateway 28s mein reply nahi diya — Smartflo/agent side check karo (from ${input.from10}).`
        : String(e?.message || 'Click-to-call gateway error'),
      from: input.from10,
      to: input.to10,
      did: input.did,
      provider: input.cfg.provider,
      via: 'gateway',
      url: url.toString(),
    };
  }
}

/** Manual Call + Fresh auto-dial */
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

  const resolved = resolveExclusiveDidForTelecaller(cfg, input.telecallerId, input.did);
  if (!resolved.ok) {
    return {
      ok: false,
      error: resolved.error,
      status: 403,
      from: from10,
      to: to10,
    };
  }
  const did = resolved.did;

  // Prefer gateway first — it maps agent phone correctly; Smartflo direct
  // often needs agent *ID* not mobile and can hang.
  const gatewayResult = await hitGatewayUrl({ cfg, from10, to10, did });
  if (gatewayResult.ok) return gatewayResult;

  // Optional direct Smartflo fallback when token exists
  if (cfg.smartflo_api_token && (cfg.dial_mode || 'agent_first') !== 'customer_first') {
    console.warn('[click-to-call] gateway failed, trying smartflo direct:', gatewayResult.error);
    const direct = await hitSmartfloDirect({ cfg, from10, to10, did });
    if (direct.ok) return direct;
    if (/providers?\s+failed|busy|try again|temporarily/i.test(String(direct.error || ''))) {
      await new Promise((r) => setTimeout(r, 1200));
      const retry = await hitSmartfloDirect({ cfg, from10, to10, did });
      if (retry.ok) return retry;
    }
    return {
      ...gatewayResult,
      error: gatewayResult.error || direct.error,
      upstream: {
        gateway: gatewayResult.upstream,
        smartflo: direct.upstream,
      },
    };
  }

  return gatewayResult;
}

/**
 * Same dial path as Call button — when Fresh/NEW lead is assigned
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

  const hours = evaluateAutoDialWindow(cfg, telecallerId);
  if (!hours.allowed) {
    const waitForWindow = hours.reason !== 'auto_dial_off';
    if (!waitForWindow && input.leadId) {
      try {
        await clearAutoDialPending(String(input.leadId));
      } catch {
        /* ignore */
      }
    }
    if (waitForWindow && input.leadId) {
      try {
        await markAutoDialPending(String(input.leadId), hours.reason);
      } catch (e) {
        console.warn('[autoDialFresh] pending mark failed:', e);
      }
    }
    return {
      ok: false,
      skipped: true,
      reason:
        hours.reason === 'auto_dial_off'
          ? 'auto_dial_off_for_telecaller'
          : `outside_calling_hours ${hours.now_hhmm} IST ${hours.weekday_label} (window ${hours.window.start}–${hours.window.end})`,
    };
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
  }).then(async (result) => {
    if (result.ok && input.leadId && telecallerId) {
      try {
        await supabaseAdmin.from('telecaller_call_logs').insert({
          lead_id: String(input.leadId),
          telecaller_id: telecallerId,
          call_type: 'OUTBOUND',
          call_status: 'RINGING',
          notes: '[Click-to-call] Auto-dial Fresh — recording syncs after hangup',
          phone_number: to,
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[autoDialFresh] pending log insert failed:', e);
      }
      try {
        await clearAutoDialPending(String(input.leadId));
      } catch (e) {
        console.warn('[autoDialFresh] pending clear failed:', e);
      }
    }
    return result;
  });
}

async function mergeLeadCouponMeta(
  leadId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return;
  const { data } = await supabaseAdmin
    .from('service_leads')
    .select('coupon_meta')
    .eq('id', leadId)
    .maybeSingle();
  const prev =
    data?.coupon_meta && typeof data.coupon_meta === 'object' && !Array.isArray(data.coupon_meta)
      ? { ...(data.coupon_meta as Record<string, unknown>) }
      : {};
  await supabaseAdmin.from('service_leads').update({ coupon_meta: { ...prev, ...patch } }).eq('id', leadId);
}

async function markAutoDialPending(leadId: string, reason: string): Promise<void> {
  await mergeLeadCouponMeta(leadId, {
    auto_dial_pending: true,
    auto_dial_skip_reason: reason,
    auto_dial_skipped_at: new Date().toISOString(),
  });
}

export async function clearAutoDialPending(leadId: string): Promise<void> {
  await mergeLeadCouponMeta(leadId, {
    auto_dial_pending: false,
    auto_dial_skip_reason: null,
    auto_dial_last_at: new Date().toISOString(),
  });
}
