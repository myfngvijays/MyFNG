/**
 * Live click-to-call sessions for dialer UI.
 * Prefer Smartflo live_calls + webhooks — never invent ANSWERED without evidence.
 */

import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { normalizePhone10 } from '@/lib/telecaller/initiateClickToCall';
import {
  SMARTFLO_API_BASE,
  fetchSmartfloCallRecords,
  getSmartfloApiToken,
} from '@/lib/telecaller/smartfloCdr';

export type DialSessionStatus =
  | 'INITIATED'
  | 'RINGING'
  | 'ANSWERED'
  | 'ENDED'
  | 'MISSED'
  | 'FAILED';

export type DialSessionRow = {
  id: string;
  telecaller_id?: string | null;
  lead_id?: string | null;
  call_log_id?: string | null;
  agent_phone: string;
  customer_phone: string;
  did_number?: string | null;
  status: DialSessionStatus;
  smartflo_call_id?: string | null;
  smartflo_ref_id?: string | null;
  error_message?: string | null;
  started_at: string;
  answered_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number | null;
  last_event?: string | null;
};

function digitsLast10(raw: unknown): string | null {
  return normalizePhone10(raw);
}

function phoneEquals(a: unknown, b: unknown): boolean {
  const x = digitsLast10(a);
  const y = digitsLast10(b);
  return Boolean(x && y && x === y);
}

function parseCallTimeToSec(raw: unknown): number | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  const hms = s.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (hms) {
    return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function extractRefOrCallId(upstream: unknown): { refId: string | null; callId: string | null } {
  const u = upstream as Record<string, unknown> | null;
  if (!u || typeof u !== 'object') return { refId: null, callId: null };
  const nested = (u.data || u.result || u.response || u) as Record<string, unknown>;
  const attemptRaw = Array.isArray((u as any).attempts)
    ? ((u as any).attempts[0]?.raw || (u as any).attempts[0])
    : null;
  const pick = (...keys: string[]) => {
    for (const src of [nested, u, attemptRaw, (u as any).last_error]) {
      if (!src || typeof src !== 'object') continue;
      for (const k of keys) {
        const v = (src as any)[k];
        if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
      }
    }
    return null;
  };
  return {
    refId: pick('ref_id', 'refId', 'reference_id', 'request_id'),
    callId: pick('call_id', 'callId', 'uuid'),
  };
}

async function fetchSmartfloLiveCalls(input: {
  token: string;
  agentPhone?: string | null;
  did?: string | null;
  callId?: string | null;
}): Promise<any[]> {
  const url = new URL(`${SMARTFLO_API_BASE}/live_calls`);
  if (input.agentPhone) {
    const a = digitsLast10(input.agentPhone);
    if (a) url.searchParams.set('agent_number', a.length === 10 ? `91${a}` : a);
  }
  if (input.did) {
    const d = String(input.did).replace(/\D/g, '');
    if (d) url.searchParams.set('did_number', d);
  }
  if (input.callId) url.searchParams.set('call_id', String(input.callId));

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.token}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return [];
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.data)) return json.data;
    if (Array.isArray(json?.results)) return json.results;
    if (Array.isArray(json?.calls)) return json.calls;
    return [];
  } catch {
    return [];
  }
}

function liveCallMatchesCustomer(row: any, customer10: string): boolean {
  const fields = [
    row?.customer_number,
    row?.destination,
    row?.broadcast_no,
    row?.multiple_destination_name,
    row?.source,
  ];
  return fields.some((f) => {
    const text = String(f || '');
    if (phoneEquals(text, customer10)) return true;
    // destination sometimes comma-separated
    return text
      .split(/[,;\s]+/)
      .some((part) => phoneEquals(part, customer10));
  });
}

function liveStateIsAnswered(state: unknown): boolean {
  const s = String(state || '').toLowerCase();
  if (!s) return false;
  if (/miss|hangup|end|fail|idle|cancel/.test(s)) return false;
  return /answer|bridge|connect|talk|progress|active/.test(s);
}

/**
 * Pull live status from Smartflo (live_calls + recent CDR) into the dial session.
 * Called on every dialer poll so UI advances without webhooks.
 */
export async function refreshDialSessionFromSmartflo(
  session: DialSessionRow,
): Promise<DialSessionRow> {
  const status = String(session.status || '').toUpperCase() as DialSessionStatus;
  if (!['INITIATED', 'RINGING', 'ANSWERED'].includes(status)) return session;

  const token = await getSmartfloApiToken();
  if (!token) return session;

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return session;

  const customer10 = digitsLast10(session.customer_phone);
  if (!customer10) return session;

  const nowIso = new Date().toISOString();
  const liveRowsPrimary = await fetchSmartfloLiveCalls({
    token,
    agentPhone: session.agent_phone,
    did: session.did_number,
    callId: session.smartflo_call_id,
  });
  // Agent number format sometimes mismatches — also scan all live calls
  const liveRowsAll =
    liveRowsPrimary.length > 0
      ? liveRowsPrimary
      : await fetchSmartfloLiveCalls({ token, callId: session.smartflo_call_id });
  const liveRows = liveRowsAll.length ? liveRowsAll : liveRowsPrimary;

  const liveHit =
    liveRows.find((r) => liveCallMatchesCustomer(r, customer10)) ||
    (session.smartflo_call_id
      ? liveRows.find((r) => String(r?.call_id || '') === String(session.smartflo_call_id))
      : null);

  if (liveHit) {
    const state = String(liveHit.state || '');
    const answered = liveStateIsAnswered(state) || /answer/i.test(state);
    const elapsed = parseCallTimeToSec(liveHit.call_time);
    const callId = liveHit.call_id ? String(liveHit.call_id) : session.smartflo_call_id || null;

    if (answered || status === 'ANSWERED') {
      const answeredAt =
        session.answered_at ||
        (elapsed != null
          ? new Date(Date.now() - elapsed * 1000).toISOString()
          : nowIso);
      const patch: Record<string, unknown> = {
        status: 'ANSWERED',
        answered_at: answeredAt,
        last_event: `live_calls:${state || 'Answered'}`,
        raw_last_event: liveHit,
        updated_at: nowIso,
      };
      if (callId) patch.smartflo_call_id = callId;

      await supabaseAdmin.from('smartflo_dial_sessions').update(patch).eq('id', session.id);
      return { ...session, ...patch, status: 'ANSWERED', answered_at: answeredAt } as DialSessionRow;
    }

    // Still ringing on live board
    if (status === 'INITIATED' || status === 'RINGING') {
      const patch = {
        status: 'RINGING' as const,
        last_event: `live_calls:${state || 'ringing'}`,
        raw_last_event: liveHit,
        updated_at: nowIso,
        smartflo_call_id: callId || session.smartflo_call_id || null,
      };
      await supabaseAdmin.from('smartflo_dial_sessions').update(patch).eq('id', session.id);
      return { ...session, ...patch };
    }
  }

  // Was live ANSWERED, now gone from live board → treat as ended
  if (status === 'ANSWERED' && !liveHit) {
    const durationSec = session.answered_at
      ? Math.max(0, Math.floor((Date.now() - new Date(session.answered_at).getTime()) / 1000))
      : null;
    const patch = {
      status: 'ENDED' as const,
      ended_at: nowIso,
      duration_seconds: durationSec,
      last_event: 'live_calls:ended',
      updated_at: nowIso,
    };
    await supabaseAdmin.from('smartflo_dial_sessions').update(patch).eq('id', session.id);
    return { ...session, ...patch };
  }

  // RINGING with no live hit — check very recent CDR (call may have finished quickly)
  const startedMs = new Date(session.started_at).getTime();
  if (status === 'RINGING' && Date.now() - startedMs > 20_000) {
    const fromDate = new Date(startedMs - 60_000).toISOString().slice(0, 19).replace('T', ' ');
    const toDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const cdr = await fetchSmartfloCallRecords({
      token,
      fromDate,
      toDate,
      limit: 25,
      timeoutMs: 8000,
    });
    if (cdr.ok) {
      const hit = cdr.results.find((r) => {
        const client = digitsLast10((r as any).client_number || (r as any).customer_number);
        return client === customer10;
      });
      if (hit) {
        const st = String((hit as any).status || (hit as any).hangup_cause || '').toLowerCase();
        const dur =
          Number((hit as any).call_duration ?? (hit as any).answered_seconds ?? 0) || 0;
        const callId = String((hit as any).call_id || (hit as any).uuid || '') || null;
        if (dur > 0 || /answer/.test(st)) {
          const patch = {
            status: 'ENDED' as const,
            answered_at:
              session.answered_at ||
              new Date(Date.now() - Math.max(dur, 1) * 1000).toISOString(),
            ended_at: nowIso,
            duration_seconds: dur || null,
            smartflo_call_id: callId || session.smartflo_call_id || null,
            last_event: 'cdr:completed',
            raw_last_event: hit as any,
            updated_at: nowIso,
          };
          await supabaseAdmin.from('smartflo_dial_sessions').update(patch).eq('id', session.id);
          return { ...session, ...patch };
        }
        if (/miss|no.?answer|not.?connected|busy/.test(st)) {
          const patch = {
            status: 'MISSED' as const,
            ended_at: nowIso,
            last_event: 'cdr:missed',
            error_message: st || 'Missed',
            updated_at: nowIso,
          };
          await supabaseAdmin.from('smartflo_dial_sessions').update(patch).eq('id', session.id);
          return { ...session, ...patch };
        }
      }
    }
  }

  return session;
}

export async function createDialSession(input: {
  telecallerId?: string | null;
  leadId?: string | null;
  agentPhone: string;
  customerPhone: string;
  did?: string | null;
  upstream?: unknown;
  callLogId?: string | null;
}): Promise<DialSessionRow | null> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  const agent = digitsLast10(input.agentPhone);
  const customer = digitsLast10(input.customerPhone);
  if (!agent || !customer) return null;

  const { refId, callId } = extractRefOrCallId(input.upstream);
  const row = {
    telecaller_id: input.telecallerId || null,
    lead_id: input.leadId || null,
    call_log_id: input.callLogId || null,
    agent_phone: agent,
    customer_phone: customer,
    did_number: input.did ? String(input.did).replace(/\D/g, '') : null,
    status: 'RINGING' as DialSessionStatus,
    smartflo_call_id: callId,
    smartflo_ref_id: refId,
    started_at: new Date().toISOString(),
    last_event: 'click_to_call_accepted',
    raw_last_event: input.upstream ? (input.upstream as object) : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('smartflo_dial_sessions')
    .insert(row)
    .select('*')
    .maybeSingle();

  if (error) {
    console.warn('[dial-session] create failed:', error.message);
    return null;
  }
  return data as DialSessionRow;
}

export async function getDialSession(sessionId: string): Promise<DialSessionRow | null> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin || !sessionId) return null;
  const { data, error } = await supabaseAdmin
    .from('smartflo_dial_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !data) return null;
  return data as DialSessionRow;
}

function classifyWebhookEvent(body: Record<string, unknown>): {
  kind: 'answered' | 'ringing' | 'ended' | 'missed' | 'unknown';
  label: string;
} {
  const status = String(
    body.call_status || body.status || body.$call_status || body.$status || body.hangup_cause || '',
  ).toLowerCase();
  const trigger = String(
    body.trigger || body.event || body.event_type || body.webhook_type || body.name || '',
  ).toLowerCase();
  const text = `${trigger} ${status}`;

  // Hangup / end first (even if status says answered)
  if (/hangup|ended|disconnect|completed/.test(trigger) || /hangup/.test(status)) {
    if (/missed|no.?answer|not.?connected/.test(text)) {
      return { kind: 'missed', label: trigger || status || 'missed' };
    }
    return { kind: 'ended', label: trigger || status || 'hangup' };
  }

  if (/missed by customer|missed by agent|no.?answer|not.?connected/.test(text)) {
    return { kind: 'missed', label: trigger || status || 'missed' };
  }

  if (
    /answered by customer|call connected to agent|customer.?answered|bridged/.test(text) ||
    status === 'answered by customer'
  ) {
    return { kind: 'answered', label: trigger || status || 'answered' };
  }

  // Agent picked up first leg — still waiting for customer; keep RINGING
  if (/answered by agent|session call answered|dialed on agent/.test(text)) {
    return { kind: 'ringing', label: trigger || status || 'agent_leg' };
  }

  if (/ringing|initiated|received on server/.test(text)) {
    return { kind: 'ringing', label: trigger || status || 'ringing' };
  }

  return { kind: 'unknown', label: trigger || status || 'event' };
}

function pickBody(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  }
  return null;
}

async function findOpenSession(opts: {
  callId?: string | null;
  refId?: string | null;
  customerPhone?: string | null;
  agentPhone?: string | null;
}): Promise<DialSessionRow | null> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  if (opts.callId) {
    const { data } = await supabaseAdmin
      .from('smartflo_dial_sessions')
      .select('*')
      .eq('smartflo_call_id', opts.callId)
      .maybeSingle();
    if (data) return data as DialSessionRow;
  }
  if (opts.refId) {
    const { data } = await supabaseAdmin
      .from('smartflo_dial_sessions')
      .select('*')
      .eq('smartflo_ref_id', opts.refId)
      .maybeSingle();
    if (data) return data as DialSessionRow;
  }

  const customer = digitsLast10(opts.customerPhone);
  const agent = digitsLast10(opts.agentPhone);
  if (!customer && !agent) return null;

  const since = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  let q = supabaseAdmin
    .from('smartflo_dial_sessions')
    .select('*')
    .in('status', ['INITIATED', 'RINGING', 'ANSWERED'])
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(5);

  if (customer) q = q.eq('customer_phone', customer);
  const { data: rows } = await q;
  const list = (rows || []) as DialSessionRow[];
  if (!list.length) return null;
  if (agent) {
    const hit = list.find((r) => r.agent_phone === agent);
    if (hit) return hit;
  }
  return list[0] || null;
}

/**
 * Apply a Smartflo live/hangup webhook onto the matching dial session.
 * Safe to call even when recording upsert fails / has no recording_url.
 */
export async function applyWebhookToDialSession(
  body: Record<string, unknown>,
): Promise<{ updated: boolean; sessionId?: string; status?: string }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { updated: false };

  const callId = pickBody(body.call_id, body.$call_id, body.uuid, body.$uuid, body.callId);
  const refId = pickBody(body.ref_id, body.$ref_id, body.refId, body.reference_id);
  const customer = pickBody(
    body.customer_number_with_prefix,
    body.$customer_number_with_prefix,
    body.customer_no_with_prefix,
    body.$customer_no_with_prefix,
    body.client_number,
    body.$client_number,
    body.call_to_number,
    body.$call_to_number,
    body.destination_number,
  );
  const agent = pickBody(
    body.answer_agent_number,
    body.$answer_agent_number,
    body.agent_number,
    body.$agent_number,
    body.answered_agent_number,
    body.$answered_agent_number,
  );

  const session = await findOpenSession({
    callId,
    refId,
    customerPhone: customer,
    agentPhone: agent,
  });
  if (!session) return { updated: false };

  const { kind, label } = classifyWebhookEvent(body);
  const now = new Date().toISOString();
  const durationRaw = pickBody(
    body.call_duration,
    body.$call_duration,
    body.answered_seconds,
    body.$answered_sec,
    body.duration,
  );
  const duration = durationRaw != null ? Number(durationRaw) : null;
  const durationSec =
    Number.isFinite(duration) && (duration as number) >= 0 ? Math.round(duration as number) : null;

  const patch: Record<string, unknown> = {
    last_event: label,
    raw_last_event: body,
    updated_at: now,
  };
  if (callId && !session.smartflo_call_id) patch.smartflo_call_id = callId;
  if (refId && !session.smartflo_ref_id) patch.smartflo_ref_id = refId;

  if (kind === 'answered') {
    if (session.status !== 'ANSWERED' && session.status !== 'ENDED') {
      patch.status = 'ANSWERED';
      patch.answered_at = session.answered_at || now;
    }
  } else if (kind === 'ringing') {
    if (session.status === 'INITIATED') patch.status = 'RINGING';
  } else if (kind === 'missed') {
    patch.status = 'MISSED';
    patch.ended_at = now;
    if (durationSec != null) patch.duration_seconds = durationSec;
  } else if (kind === 'ended') {
    patch.status = 'ENDED';
    patch.ended_at = now;
    if (durationSec != null) patch.duration_seconds = durationSec;
    // If hangup has talk time but we never got answer webhook, still mark answered_at
    if (durationSec != null && durationSec > 0 && !session.answered_at) {
      patch.answered_at = new Date(Date.now() - durationSec * 1000).toISOString();
    }
  } else {
    // unknown — only attach ids
    if (!callId && !refId) return { updated: false };
  }

  const { error } = await supabaseAdmin
    .from('smartflo_dial_sessions')
    .update(patch)
    .eq('id', session.id);

  if (error) {
    console.warn('[dial-session] webhook update failed:', error.message);
    return { updated: false };
  }

  return {
    updated: true,
    sessionId: session.id,
    status: String(patch.status || session.status),
  };
}

export function publicDialSessionPayload(row: DialSessionRow) {
  const status = String(row.status || '').toUpperCase() as DialSessionStatus;
  let elapsed_seconds: number | null = null;
  if (status === 'ANSWERED' && row.answered_at) {
    elapsed_seconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(row.answered_at).getTime()) / 1000),
    );
  } else if ((status === 'ENDED' || status === 'MISSED') && row.duration_seconds != null) {
    elapsed_seconds = Number(row.duration_seconds);
  } else if (status === 'ENDED' && row.answered_at && row.ended_at) {
    elapsed_seconds = Math.max(
      0,
      Math.floor(
        (new Date(row.ended_at).getTime() - new Date(row.answered_at).getTime()) / 1000,
      ),
    );
  }

  return {
    id: row.id,
    status,
    agent_phone: row.agent_phone,
    customer_phone: row.customer_phone,
    lead_id: row.lead_id || null,
    started_at: row.started_at,
    answered_at: row.answered_at || null,
    ended_at: row.ended_at || null,
    duration_seconds: row.duration_seconds ?? null,
    elapsed_seconds,
    last_event: row.last_event || null,
    error_message: row.error_message || null,
  };
}
