/**
 * Smartflo CDR client + match recordings onto CRM call logs / leads.
 * Auth: Bearer token from Click-to-Call settings (smartflo_api_token / SMARTFLO_API_TOKEN).
 */

import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getClickToCallConfig,
  DEFAULT_CLICK_TO_CALL_DIDS,
  ownerOfDid,
  poolDidPhoneSet,
  type ClickToCallConfig,
} from '@/lib/telecaller/clickToCallConfig';
import { normalizePhone10 } from '@/lib/telecaller/initiateClickToCall';
import { enqueueCallIqOnRecordingCompleted } from '@/lib/telecaller/callIqWorkflow';
import { enqueueCrmDlOnRecordingCompleted } from '@/lib/telecaller/leadDlVoice';

export const SMARTFLO_API_BASE = 'https://api-smartflo.tatateleservices.com/v1';

/**
 * Only sync/attach call recordings on/after this IST calendar day.
 * Older Smartflo CDRs are ignored (and detached from CRM call logs).
 */
export const SMARTFLO_RECORDINGS_CUTOFF_IST = '2026-08-20';

/** Smartflo query from_date floor: start of cutoff day in IST wall clock. */
export function smartfloRecordingsMinFrom(): string {
  return `${SMARTFLO_RECORDINGS_CUTOFF_IST} 00:00:00`;
}

/** UTC instant for start of cutoff day (IST midnight). */
export function smartfloRecordingsCutoffIso(): string {
  return `${SMARTFLO_RECORDINGS_CUTOFF_IST}T00:00:00+05:30`;
}

export function isBeforeSmartfloRecordingsCutoff(
  startedAt?: string | null,
  endedAt?: string | null,
  fallbackCreatedAt?: string | null,
): boolean {
  const cutoffMs = Date.parse(smartfloRecordingsCutoffIso());
  if (!Number.isFinite(cutoffMs)) return false;
  for (const raw of [startedAt, endedAt, fallbackCreatedAt]) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const t = Date.parse(s);
    if (Number.isFinite(t)) return t < cutoffMs;
  }
  return false;
}

export type SmartfloCdrRecord = {
  id?: string;
  call_id?: string;
  uuid?: string;
  direction?: string;
  status?: string;
  description?: string;
  recording_url?: string | null;
  date?: string;
  time?: string;
  end_stamp?: string;
  call_duration?: number | string | null;
  answered_seconds?: number | string | null;
  agent_number?: string | null;
  agent_name?: string | null;
  client_number?: string | null;
  did_number?: string | null;
  hangup_cause?: string | null;
  reason?: string | null;
  [key: string]: unknown;
};

export type SyncSmartfloRecordingsResult = {
  ok: boolean;
  error?: string;
  fetched: number;
  upserted: number;
  matched: number;
  updated_logs: number;
  created_logs: number;
  with_recording: number;
  from_date: string;
  to_date: string;
  pages: number;
  truncated?: boolean;
  elapsed_ms?: number;
  repair?: { scanned: number; repaired: number; created_logs: number };
  detach?: { cleared_logs: number; cleared_cdr_links: number };
};

function digitsOnly(raw: unknown): string {
  return String(raw || '').replace(/\D/g, '');
}

function isIndianMobile10(phone10: string | null): boolean {
  return Boolean(phone10 && /^[6-9]\d{9}$/.test(phone10));
}

const CUSTOMER_NUMBER_KEYS =
  /customer|destinat|callee|called|to_number|^to$|^dst$|broadcast|client_number|call_to/i;

function collectCustomerMobile10s(rec: Record<string, unknown>, depth = 0, into: string[] = []): string[] {
  if (depth > 2 || rec == null) return into;
  for (const [key, val] of Object.entries(rec)) {
    if (val == null) continue;
    if (typeof val === 'string' || typeof val === 'number') {
      if (CUSTOMER_NUMBER_KEYS.test(key)) {
        const p = normalizePhone10(val);
        if (isIndianMobile10(p) && p) into.push(p);
      }
    } else if (typeof val === 'object' && !Array.isArray(val) && depth < 2) {
      collectCustomerMobile10s(val as Record<string, unknown>, depth + 1, into);
    }
  }
  return into;
}

function knownDidPhones(extra?: Set<string> | null): Set<string> {
  const set = new Set<string>();
  for (const d of DEFAULT_CLICK_TO_CALL_DIDS) {
    const p = normalizePhone10(d);
    if (p) set.add(p);
  }
  if (extra) {
    for (const p of extra) {
      if (p) set.add(p);
    }
  }
  return set;
}

let cachedCtc: { at: number; cfg: ClickToCallConfig } | null = null;
async function clickToCallConfigCached(): Promise<ClickToCallConfig> {
  if (cachedCtc && Date.now() - cachedCtc.at < 30_000) return cachedCtc.cfg;
  const cfg = await getClickToCallConfig();
  cachedCtc = { at: Date.now(), cfg };
  return cfg;
}

async function ourDidPool(): Promise<Set<string>> {
  return poolDidPhoneSet(await clickToCallConfigCached());
}

/** Tata DID / caller-id on this CDR (prefers a number that is in the MyFNG 5-DID pool). */
function pickCdrDidNumber(
  rec: SmartfloCdrRecord,
  extraDids?: Set<string> | null,
): string | null {
  const pool = knownDidPhones(extraDids);
  const candidates = [
    rec.did_number,
    rec.caller_id_number,
    rec.caller_id,
    rec.broadcast_no,
    rec.service_number,
    rec.agent_number,
  ];
  for (const raw of candidates) {
    const p = normalizePhone10(raw);
    if (p && pool.has(p)) return digitsOnly(raw) || p;
  }
  const d = digitsOnly(rec.did_number);
  return d.length >= 10 ? d : null;
}

function cdrUsesPoolDid(
  rec: {
    did_number?: unknown;
    agent_number?: unknown;
    caller_id_number?: unknown;
    caller_id?: unknown;
    broadcast_no?: unknown;
    service_number?: unknown;
  },
  pool: Set<string>,
): boolean {
  for (const raw of [
    rec.did_number,
    rec.caller_id_number,
    rec.caller_id,
    rec.broadcast_no,
    rec.service_number,
    rec.agent_number,
  ]) {
    const p = normalizePhone10(raw);
    if (p && pool.has(p)) return true;
  }
  return false;
}

/**
 * Other Tata DIDs (not the 5 MyFNG numbers). Empty did_number is NOT foreign —
 * Tata click-to-call often omits it. Never treat customer caller-id as a DID.
 */
function isExplicitForeignDid(
  rec: {
    did_number?: unknown;
  },
  pool: Set<string>,
): boolean {
  if (!pool.size) return false;
  const did10 = normalizePhone10(rec.did_number);
  if (!did10) return false;
  if (pool.has(did10)) return false;
  return true;
}

/** True when the number is a Smartflo DID / agent line, not a CRM customer mobile. */
export function isSmartfloLineNumber(raw: unknown, extraDids?: Set<string> | null): boolean {
  const p = normalizePhone10(raw);
  if (!p) return false;
  return knownDidPhones(extraDids).has(p);
}

/** Tata outbound click-to-call often puts the customer on destination / customer_number, not client_number. */
function pickCdrCustomerNumber(rec: SmartfloCdrRecord, extraDids?: Set<string> | null): string | null {
  const dids = knownDidPhones(extraDids);
  const pickedDid = normalizePhone10(pickCdrDidNumber(rec, extraDids));
  const did10 = pickedDid || normalizePhone10(rec.did_number);
  const agent10 = normalizePhone10(rec.agent_number);
  if (did10) dids.add(did10);
  if (agent10) dids.add(agent10);
  const named = [
    rec.customer_number,
    rec.customer_number_with_prefix,
    rec.destination,
    rec.destination_number,
    rec.call_to_number,
    rec.called_number,
    rec.callee,
    rec.broadcast_no,
    rec.to,
    rec.dst,
    rec.caller_id_num,
    rec.callerid,
    (rec.contact_details as Record<string, unknown> | undefined)?.field_0,
    rec.client_number,
  ].map((v) => normalizePhone10(v));
  const walked = collectCustomerMobile10s(rec as Record<string, unknown>);
  const candidates = [...named, ...walked].filter((p): p is string => Boolean(p));
  const unique = [...new Set(candidates)];
  const mobile = unique.find((p) => isIndianMobile10(p) && !dids.has(p));
  return mobile || null;
}

function cdrMentionsPhone(rec: SmartfloCdrRecord, phone10: string): boolean {
  if (!phone10 || phone10.length < 10) return false;
  try {
    const blob = JSON.stringify(rec);
    return blob.includes(phone10);
  } catch {
    return false;
  }
}

/** Collapse agent-leg + customer-leg CDRs (same lead, ~same second) into one row. */
export function dedupeSmartfloCrmRows<T extends Record<string, any>>(rows: T[]): T[] {
  const out: T[] = [];
  for (const r of rows) {
    const leadId = String(r.lead_id || r.lead?.id || '').trim();
    const t = Date.parse(String(r.started_at || r.created_at || '')) || 0;
    const dur = Number(r.call_duration || 0) || 0;
    const twin = out.find((p) => {
      const pLead = String(p.lead_id || p.lead?.id || '').trim();
      if (!leadId || !pLead || pLead !== leadId) return false;
      const pt = Date.parse(String(p.started_at || p.created_at || '')) || 0;
      const pDur = Number(p.call_duration || 0) || 0;
      return Math.abs(pt - t) <= 150_000 && pDur === dur;
    });
    if (!twin) {
      out.push(r);
      continue;
    }
    const twinRec = String(twin.recording_url || '').trim();
    const nextRec = String(r.recording_url || '').trim();
    if (!twinRec && nextRec) {
      const idx = out.indexOf(twin);
      if (idx >= 0) out[idx] = r;
    }
  }
  return out;
}

function pickCdrRecordingUrl(
  rec: SmartfloCdrRecord,
  callId?: string | null,
  opts?: { inventIfAnswered?: boolean; duration?: number | null },
): string | null {
  let fromApi: string | null = null;
  for (const key of [
    'recording_url',
    'recordingUrl',
    'recording',
    'record_url',
    'record_file',
    'recording_file',
    'file',
  ]) {
    const v = String((rec as Record<string, unknown>)[key] || '').trim();
    if (/^https?:\/\//i.test(v)) {
      fromApi = v;
      break;
    }
  }
  if (fromApi) return boundRecordingUrlForCallId(callId, fromApi);
  if (opts?.inventIfAnswered && callId && (opts.duration || 0) > 0) {
    return recordingUrlForCallId(String(callId));
  }
  return null;
}

/** Tata portal file URL — audio is keyed by callId, not by a shared token. */
export const SMARTFLO_CLOUDPHONE_RECORDING_BASE =
  'https://cloudphone.tatateleservices.com/file/recording';

export function recordingUrlForCallId(callId: string): string {
  return `${SMARTFLO_CLOUDPHONE_RECORDING_BASE}?callId=${encodeURIComponent(callId)}&type=rec`;
}

export function callIdFromRecordingUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return String(u.searchParams.get('callId') || u.searchParams.get('call_id') || '').trim() || null;
  } catch {
    return null;
  }
}

/** Never play another call's file: URL must be this Smartflo callId. */
export function boundRecordingUrlForCallId(
  callId: string | null | undefined,
  storedUrl: string | null | undefined,
): string | null {
  const id = String(callId || '').trim();
  const stored = String(storedUrl || '').trim();
  if (id) {
    if (stored) {
      const inUrl = callIdFromRecordingUrl(stored);
      if (!inUrl || inUrl === id) return stored;
      return recordingUrlForCallId(id);
    }
    return null;
  }
  return /^https?:\/\//i.test(stored) ? stored : null;
}

function toInt(raw: unknown): number | null {
  const n = Number(raw);
  if (Number.isFinite(n)) return Math.round(n);
  const s = String(raw || '').trim();
  const hms = s.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (hms) return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
  const ms = s.match(/^(\d+):(\d{2})$/);
  if (ms) return Number(ms[1]) * 60 + Number(ms[2]);
  return null;
}

/** Format for Smartflo query: "YYYY-MM-DD HH:mm:ss" (IST-ish wall clock is fine; API accepts). */
export function formatSmartfloDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  // Use Asia/Kolkata wall time — Smartflo accounts are typically IST.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

function parseSmartfloStamp(rec: SmartfloCdrRecord): {
  startedAt: string | null;
  endedAt: string | null;
} {
  const endRaw = String(rec.end_stamp || '').trim();
  let endedAt: string | null = null;
  if (endRaw) {
    const iso = endRaw.includes('T') ? endRaw : endRaw.replace(' ', 'T');
    const t = Date.parse(iso);
    endedAt = Number.isFinite(t) ? new Date(t).toISOString() : null;
  }

  const date = String(rec.date || '').trim();
  const time = String(rec.time || '').trim();
  let startedAt: string | null = null;
  if (date && time) {
    const iso = `${date}T${time.length === 5 ? `${time}:00` : time}`;
    const t = Date.parse(iso);
    startedAt = Number.isFinite(t) ? new Date(t).toISOString() : null;
  } else if (endedAt && rec.call_duration != null) {
    const dur = toInt(rec.call_duration) || 0;
    startedAt = new Date(new Date(endedAt).getTime() - dur * 1000).toISOString();
  }
  if (!startedAt) {
    const isoRaw = String((rec as any).started_at || (date.includes('T') ? date : '') || '').trim();
    if (isoRaw) {
      const t = Date.parse(isoRaw.includes('T') ? isoRaw : isoRaw.replace(' ', 'T'));
      if (Number.isFinite(t)) startedAt = new Date(t).toISOString();
    }
  }

  return { startedAt, endedAt };
}

export async function getSmartfloApiToken(): Promise<string> {
  const cfg = await getClickToCallConfig();
  return String(cfg.smartflo_api_token || process.env.SMARTFLO_API_TOKEN || '').trim();
}

export async function fetchSmartfloCallRecords(input: {
  token: string;
  fromDate: string;
  toDate: string;
  page?: number;
  limit?: number;
  callId?: string | null;
  /** Tata query: callerid = client/customer number */
  callerid?: string | null;
  /** Tata query: destination */
  destination?: string | null;
  /** Tata query: did_number (one of our 5 DIDs) */
  didNumber?: string | null;
  /** Tata OpenAPI: comma-separated did_numbers */
  didNumbers?: string[] | null;
  /** Tata query: services e.g. "Click to Call" */
  services?: string | null;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; count: number; results: SmartfloCdrRecord[]; error?: string; raw?: unknown }> {
  const page = Math.max(1, input.page || 1);
  const limit = Math.min(100, Math.max(1, input.limit || 50));
  const url = new URL(`${SMARTFLO_API_BASE}/call/records`);
  url.searchParams.set('from_date', input.fromDate);
  url.searchParams.set('to_date', input.toDate);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(limit));
  if (input.callId) url.searchParams.set('call_id', input.callId);
  const callerid = String(input.callerid || '').replace(/\D/g, '');
  if (callerid.length >= 10) url.searchParams.set('callerid', callerid);
  const dest = String(input.destination || '').replace(/\D/g, '');
  if (dest.length >= 10) url.searchParams.set('destination', dest);
  const didList = (input.didNumbers || [])
    .map((d) => String(d || '').replace(/\D/g, ''))
    .filter((d) => d.length >= 10);
  const did = String(input.didNumber || '').replace(/\D/g, '');
  if (didList.length) {
    url.searchParams.set('did_numbers', didList.join(','));
    if (didList.length === 1) url.searchParams.set('did_number', didList[0]);
  } else if (did.length >= 10) {
    url.searchParams.set('did_number', did);
    url.searchParams.set('did_numbers', did);
  }
  const services = String(input.services || '').trim();
  if (services) url.searchParams.set('services', services);

  const timeoutMs = Math.min(30000, Math.max(5000, input.timeoutMs ?? 18000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.token}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    const aborted = e?.name === 'AbortError' || /aborted/i.test(String(e?.message || ''));
    return {
      ok: false,
      status: aborted ? 504 : 502,
      count: 0,
      results: [],
      error: aborted
        ? `Smartflo CDR timed out after ${timeoutMs}ms`
        : e?.message || 'Smartflo CDR fetch failed',
    };
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text().catch(() => '');
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      count: 0,
      results: [],
      error:
        (json && (json.message || json.error || json.msg)) ||
        text ||
        `Smartflo CDR failed (${res.status})`,
      raw: json || { raw: text },
    };
  }

  const results = Array.isArray(json?.results)
    ? (json.results as SmartfloCdrRecord[])
    : Array.isArray(json)
      ? (json as SmartfloCdrRecord[])
      : [];

  return {
    ok: true,
    status: res.status,
    count: Number(json?.count ?? results.length) || results.length,
    results,
    raw: json,
  };
}

function cdrSample(rec: SmartfloCdrRecord | undefined) {
  if (!rec) return null;
  return {
    call_id: pickCallId(rec),
    service: rec.service,
    call_hint: rec.call_hint,
    client_number: rec.client_number,
    did_number: rec.did_number,
    caller_id_num: rec.caller_id_num,
    destination: rec.destination,
    agent_number: rec.agent_number,
    recording: Boolean(String(rec.recording_url || '').trim()),
  };
}

async function fetchCdrPages(input: {
  token: string;
  fromDate: string;
  toDate: string;
  maxPages: number;
  timeoutMs?: number;
  callerid?: string | null;
  destination?: string | null;
  didNumber?: string | null;
  services?: string | null;
}): Promise<{ ok: boolean; error?: string; results: SmartfloCdrRecord[] }> {
  const results: SmartfloCdrRecord[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= input.maxPages; page += 1) {
    const batch = await fetchSmartfloCallRecords({
      token: input.token,
      fromDate: input.fromDate,
      toDate: input.toDate,
      page,
      limit: 50,
      timeoutMs: input.timeoutMs ?? 16_000,
      callerid: input.callerid,
      destination: input.destination,
      didNumber: input.didNumber,
      services: input.services,
    });
    if (!batch.ok) {
      return { ok: results.length > 0, error: batch.error, results };
    }
    for (const rec of batch.results || []) {
      const key = pickCallId(rec) || `p${page}-${results.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(rec);
    }
    if ((batch.results || []).length < 50) break;
  }
  return { ok: true, results };
}

function pickCallId(rec: SmartfloCdrRecord): string | null {
  for (const raw of [rec.call_id, rec.uuid, rec.callId, rec.uniqueid]) {
    const id = String(raw || '').trim();
    if (!id) continue;
    if (/^[a-f0-9]{24}$/i.test(id)) continue;
    return id;
  }
  return null;
}

async function findLeadIdForPhone(
  db: any,
  phone10: string | null,
  cache?: Map<string, string | null>,
): Promise<string | null> {
  if (!phone10) return null;
  if (isSmartfloLineNumber(phone10)) {
    cache?.set(phone10, null);
    return null;
  }
  if (cache?.has(phone10)) return cache.get(phone10) ?? null;

  // Exact variants first (fast) — avoid expensive ilike scan unless needed
  const { data: exactRows } = await db
    .from('service_leads')
    .select('id, customer_phone, customer_alternate_phone, updated_at, assigned_telecaller_id')
    .or(
      `customer_phone.eq.${phone10},customer_phone.eq.91${phone10},customer_phone.eq.+91${phone10},customer_phone.eq.0${phone10},customer_alternate_phone.eq.${phone10},customer_alternate_phone.eq.91${phone10},customer_alternate_phone.eq.+91${phone10}`,
    )
    .order('updated_at', { ascending: false })
    .limit(8);

  let rows = Array.isArray(exactRows) ? exactRows : [];
  if (!rows.length) {
    const { data: fromLogs } = await db
      .from('telecaller_call_logs')
      .select('lead_id, phone_number')
      .not('lead_id', 'is', null)
      .or(
        `phone_number.eq.${phone10},phone_number.eq.91${phone10},phone_number.eq.+91${phone10}`,
      )
      .limit(5);
    const logLead = (Array.isArray(fromLogs) ? fromLogs : []).find(
      (r: any) => normalizePhone10(r.phone_number) === phone10 && r.lead_id,
    );
    if (logLead?.lead_id) {
      const id = String(logLead.lead_id);
      cache?.set(phone10, id);
      return id;
    }
  }

  const exact = rows.filter(
    (r: any) =>
      normalizePhone10(r.customer_phone) === phone10 ||
      normalizePhone10(r.customer_alternate_phone) === phone10,
  );
  let pick = exact[0] || null;
  try {
    const cfg = await clickToCallConfigCached();
    const owners = new Set(
      (cfg.did_assignments || []).map((a) => String(a.telecaller_id || '').trim()).filter(Boolean),
    );
    const assigned = exact.find((r: any) => owners.has(String(r.assigned_telecaller_id || '').trim()));
    if (assigned) pick = assigned;
  } catch {
    /* config optional */
  }
  const leadId = pick ? String(pick.id).trim() || null : null;
  cache?.set(phone10, leadId);
  return leadId;
}

async function findLeadIdFromSmartfloCallId(db: any, callId: string): Promise<string | null> {
  const id = String(callId || '').trim();
  if (!id) return null;
  const { data: log } = await db
    .from('telecaller_call_logs')
    .select('lead_id')
    .eq('smartflo_call_id', id)
    .not('lead_id', 'is', null)
    .limit(1)
    .maybeSingle();
  if (log?.lead_id) return String(log.lead_id);
  try {
    const { data: sess } = await db
      .from('smartflo_dial_sessions')
      .select('lead_id')
      .eq('smartflo_call_id', id)
      .not('lead_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (sess?.lead_id) return String(sess.lead_id);
  } catch {
    /* table optional */
  }
  return null;
}

async function findLeadFromDialSession(
  db: any,
  input: {
    callId: string;
    phone10: string | null;
    didNumber: string | null;
    startedAt: string | null;
  },
): Promise<{ leadId: string | null; didNumber: string | null }> {
  const callId = String(input.callId || '').trim();
  if (callId) {
    try {
      const { data: sess } = await db
        .from('smartflo_dial_sessions')
        .select('lead_id, did_number, customer_phone')
        .eq('smartflo_call_id', callId)
        .not('lead_id', 'is', null)
        .maybeSingle();
      if (sess?.lead_id) {
        return {
          leadId: String(sess.lead_id),
          didNumber: String(sess.did_number || '').trim() || input.didNumber,
        };
      }
    } catch {
      /* table optional */
    }
  }

  const phone10 = input.phone10;
  if (!phone10) return { leadId: null, didNumber: input.didNumber };

  try {
    const center = input.startedAt ? Date.parse(input.startedAt) : Date.now();
    const fromIso = new Date((Number.isFinite(center) ? center : Date.now()) - 6 * 60 * 60 * 1000).toISOString();
    const toIso = new Date((Number.isFinite(center) ? center : Date.now()) + 2 * 60 * 60 * 1000).toISOString();
    const { data } = await db
      .from('smartflo_dial_sessions')
      .select('lead_id, did_number, customer_phone, started_at')
      .gte('started_at', fromIso)
      .lte('started_at', toIso)
      .not('lead_id', 'is', null)
      .order('started_at', { ascending: false })
      .limit(40);
    const wantDid = normalizePhone10(input.didNumber);
    const hit = (Array.isArray(data) ? data : []).find((r: any) => {
      if (normalizePhone10(r.customer_phone) !== phone10) return false;
      if (!wantDid) return true;
      const rowDid = normalizePhone10(r.did_number);
      return !rowDid || rowDid === wantDid;
    });
    if (hit?.lead_id) {
      return {
        leadId: String(hit.lead_id),
        didNumber: String(hit.did_number || '').trim() || input.didNumber,
      };
    }
  } catch {
    /* table optional */
  }
  return { leadId: null, didNumber: input.didNumber };
}

async function loadLeadPhoneIndex(db: any): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const pageSize = 1000;
  for (let from = 0; from < 20_000; from += pageSize) {
    const { data } = await db
      .from('service_leads')
      .select('id, customer_phone, customer_alternate_phone, updated_at')
      .order('updated_at', { ascending: false })
      .range(from, from + pageSize - 1);
    const rows = Array.isArray(data) ? data : [];
    for (const r of rows) {
      const leadId = String(r.id || '').trim();
      if (!leadId) continue;
      for (const field of [r.customer_phone, r.customer_alternate_phone]) {
        const p = normalizePhone10(field);
        if (p && !isSmartfloLineNumber(p) && !map.has(p)) map.set(p, leadId);
      }
    }
    if (rows.length < pageSize) break;
  }
  return map;
}

async function findOrAttachCallLog(input: {
  db: any;
  leadId: string | null;
  phone10: string | null;
  callId: string;
  recordingUrl: string | null;
  duration: number | null;
  startedAt: string | null;
  status: string | null;
  agentNumber?: string | null;
  didNumber?: string | null;
}): Promise<{ callLogId: string | null; updated: boolean; created: boolean; newRecording: boolean }> {
  const { db, leadId, phone10, callId, recordingUrl, duration, startedAt, status } = input;

  // 1) Already linked by smartflo_call_id → update same row only
  {
    const { data: byId } = await db
      .from('telecaller_call_logs')
      .select('id, call_recording_url')
      .eq('smartflo_call_id', callId)
      .maybeSingle();
    if (byId?.id) {
      const patch: Record<string, unknown> = {
        smartflo_recording_synced_at: new Date().toISOString(),
      };
      if (recordingUrl) {
        const existing = String(byId.call_recording_url || '').trim();
        const existingCall = existing ? callIdFromRecordingUrl(existing) : null;
        if (!existing || (existingCall && existingCall !== callId) || !existingCall) {
          patch.call_recording_url = recordingUrl;
        }
      }
      if (duration != null) patch.call_duration = duration;
      await db.from('telecaller_call_logs').update(patch).eq('id', byId.id);
      return {
        callLogId: String(byId.id),
        updated: true,
        created: false,
        newRecording: Boolean(recordingUrl && !byId.call_recording_url),
      };
    }
  }

  // 2) Attach only to a *pending* dial log (no Smartflo id yet, no recording yet).
  // Never reuse a log that already has another smartflo_call_id / recording —
  // that was overwriting call #1 when call #2 synced.
  if (leadId || phone10) {
    const startMs = startedAt ? Date.parse(startedAt) : NaN;
    const hasStart = Number.isFinite(startMs);
    const center = hasStart ? startMs : Date.now();
    const fromIso = hasStart || !leadId
      ? new Date(center - 12 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const toIso = hasStart || !leadId
      ? new Date(center + 4 * 60 * 60 * 1000).toISOString()
      : new Date().toISOString();

    let q = db
      .from('telecaller_call_logs')
      .select(
        'id, lead_id, phone_number, call_recording_url, created_at, smartflo_call_id, notes, call_status',
      )
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .is('smartflo_call_id', null)
      .order('created_at', { ascending: false })
      .limit(60);

    if (leadId) q = q.eq('lead_id', leadId);

    const { data: candidates } = await q;
    const rows = (Array.isArray(candidates) ? candidates : []).filter((r: any) => {
      if (r.call_recording_url) return false;
      if (r.smartflo_call_id) return false;
      if (phone10 && r.phone_number) {
        return normalizePhone10(r.phone_number) === phone10;
      }
      // lead-scoped pending RINGING / dialer stubs without phone still OK
      const st = String(r.call_status || '').toUpperCase();
      const notes = String(r.notes || '');
      return (
        st === 'RINGING' ||
        notes.includes('Dial initiated') ||
        notes.includes('Number dial') ||
        notes.includes('Auto-dial')
      );
    });

    // Prefer closest in time to CDR start; prefer RINGING dialer stubs
    rows.sort((a: any, b: any) => {
      const score = (r: any) => {
        const da = Math.abs(new Date(r.created_at).getTime() - center);
        const boost =
          String(r.call_status || '').toUpperCase() === 'RINGING' ||
          String(r.notes || '').includes('Dial')
            ? -60_000
            : 0;
        return da + boost;
      };
      return score(a) - score(b);
    });

    const hit = rows[0];
    if (hit?.id) {
      const patch: Record<string, unknown> = {
        smartflo_call_id: callId,
        smartflo_recording_synced_at: recordingUrl
          ? new Date().toISOString()
          : null,
      };
      if (recordingUrl) patch.call_recording_url = recordingUrl;
      if (duration != null) patch.call_duration = duration;
      if (phone10 && !hit.phone_number) patch.phone_number = phone10;
      const statusUpper = String(status || '').toUpperCase();
      if (
        statusUpper.includes('ANSWER') ||
        statusUpper === 'ANSWERED' ||
        (duration != null && duration > 0)
      ) {
        patch.call_status = 'ANSWERED';
      } else if (statusUpper.includes('MISS') || statusUpper.includes('NO_ANSWER')) {
        patch.call_status = 'NO_ANSWER';
      }
      if (
        String(hit.notes || '').includes('Dial initiated') ||
        String(hit.notes || '').includes('Auto-dial') ||
        String(hit.notes || '').includes('Number dial')
      ) {
        patch.notes = recordingUrl ? 'Recording synced' : 'Call synced from Smartflo CDR';
      }
      await db.from('telecaller_call_logs').update(patch).eq('id', hit.id);
      return {
        callLogId: String(hit.id),
        updated: true,
        created: false,
        newRecording: Boolean(recordingUrl),
      };
    }
  }

  // 3) New Smartflo call_id → create a CRM call log only when this number is a MyFNG lead.
  const missedLike = /miss|no[_\s-]?answer|not[_\s-]?connected/i.test(String(status || ''));
  if (leadId && (recordingUrl || (duration != null && duration > 0) || missedLike)) {
    const statusUpper = String(status || '').toUpperCase();
    const callStatus =
      statusUpper.includes('ANSWER') || statusUpper === 'ANSWERED' || (duration != null && duration > 0)
        ? 'ANSWERED'
        : statusUpper.includes('MISS') || statusUpper.includes('NO_ANSWER')
          ? 'NO_ANSWER'
          : 'COMPLETED';

    const telecallerId = await resolveTelecallerIdForCdr(db, {
      leadId,
      agentNumber: input.agentNumber || null,
      didNumber: input.didNumber || null,
    });
    if (!telecallerId) {
      return { callLogId: null, updated: false, created: false, newRecording: false };
    }

    const { data: inserted, error } = await db
      .from('telecaller_call_logs')
      .insert({
        lead_id: leadId,
        telecaller_id: telecallerId,
        call_type: 'OUTBOUND',
        call_status: callStatus,
        call_duration: duration,
        notes: recordingUrl ? 'Recording synced' : 'Call synced from Smartflo CDR',
        phone_number: phone10,
        call_recording_url: recordingUrl,
        smartflo_call_id: callId,
        smartflo_recording_synced_at: recordingUrl ? new Date().toISOString() : null,
        created_at: startedAt || new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !inserted?.id) {
      console.warn('[smartfloCdr] create call log failed:', error?.message);
      return { callLogId: null, updated: false, created: false, newRecording: false };
    }
    return {
      callLogId: String(inserted.id),
      updated: false,
      created: true,
      newRecording: Boolean(recordingUrl),
    };
  }

  return { callLogId: null, updated: false, created: false, newRecording: false };
}

async function resolveTelecallerIdForCdr(
  db: any,
  input: { leadId: string | null; agentNumber: string | null; didNumber?: string | null },
): Promise<string | null> {
  try {
    const cfg = await getClickToCallConfig();
    const fromDid = ownerOfDid(cfg, input.didNumber || '');
    if (fromDid) return fromDid;
  } catch {
    /* config optional */
  }

  if (input.leadId) {
    const { data: lead } = await db
      .from('service_leads')
      .select('assigned_telecaller_id')
      .eq('id', input.leadId)
      .maybeSingle();
    const assigned = String(lead?.assigned_telecaller_id || '').trim();
    if (assigned) return assigned;

    const { data: prev } = await db
      .from('telecaller_call_logs')
      .select('telecaller_id')
      .eq('lead_id', input.leadId)
      .not('telecaller_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const prevId = String(prev?.telecaller_id || '').trim();
    if (prevId) return prevId;
  }

  const agent10 = normalizePhone10(input.agentNumber);
  if (agent10) {
    const { data: users } = await db
      .from('users_login')
      .select('id, phone')
      .or(
        `phone.eq.${agent10},phone.eq.91${agent10},phone.eq.+91${agent10},phone.eq.0${agent10}`,
      )
      .limit(8);
    const hit = (Array.isArray(users) ? users : []).find(
      (u: any) => normalizePhone10(u.phone) === agent10,
    );
    if (hit?.id) return String(hit.id);
  }

  return null;
}

export async function upsertSmartfloRecording(
  rec: SmartfloCdrRecord,
  source: 'cdr' | 'webhook' = 'cdr',
  opts?: {
    leadCache?: Map<string, string | null>;
    /** Skip expensive lead/log matching when CDR has no recording */
    onlyAttachIfRecording?: boolean;
    /** Omit bulky raw JSON to speed upserts */
    skipRaw?: boolean;
  },
): Promise<{
  recordingRowId: string | null;
  callLogId: string | null;
  leadId: string | null;
  updatedLog: boolean;
  createdLog: boolean;
  hasRecording: boolean;
  skippedAttach: boolean;
}> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return {
      recordingRowId: null,
      callLogId: null,
      leadId: null,
      updatedLog: false,
      createdLog: false,
      hasRecording: false,
      skippedAttach: false,
    };
  }
  const db = supabaseAdmin;

  const callId = pickCallId(rec);
  if (!callId) {
    return {
      recordingRowId: null,
      callLogId: null,
      leadId: null,
      updatedLog: false,
      createdLog: false,
      hasRecording: false,
      skippedAttach: false,
    };
  }

  const pool = await ourDidPool();
  const didDigits = pickCdrDidNumber(rec, pool);
  const foreignDid = isExplicitForeignDid({ ...rec, did_number: didDigits || rec.did_number }, pool);
  const duration = toInt(rec.call_duration) ?? toInt(rec.answered_seconds);
  const { startedAt, endedAt } = parseSmartfloStamp(rec);
  const phone10 = pickCdrCustomerNumber(rec, pool);
  const statusStr = String(rec.status || rec.hangup_cause || rec.description || '');
  const answeredLike =
    (duration != null && duration > 0) || /answer|completed|hangup/i.test(statusStr);
  const recordingUrl = !foreignDid
    ? pickCdrRecordingUrl(rec, callId, {
        inventIfAnswered: true,
        duration: answeredLike ? duration || 1 : 1,
      })
    : null;
  const hasRecording = Boolean(recordingUrl);
  const onlyAttachIfRecording = opts?.onlyAttachIfRecording !== false;

  // Hard product cutoff: ignore recordings before 20 Aug 2026 (IST)
  if (isBeforeSmartfloRecordingsCutoff(startedAt, endedAt)) {
    return {
      recordingRowId: null,
      callLogId: null,
      leadId: null,
      updatedLog: false,
      createdLog: false,
      hasRecording: false,
      skippedAttach: true,
    };
  }

  const skipCrmAttach = foreignDid;

  // Fast path: no audio AND no useful outcome → skip expensive lead/log matching.
  // CDRs with duration/answered/missed must still heal pending RINGING stubs.
  const meaningfulOutcome =
    answeredLike ||
    /miss|no[_\s-]?answer|not[_\s-]?connected/i.test(statusStr);

  if (skipCrmAttach || (onlyAttachIfRecording && !hasRecording && !meaningfulOutcome)) {
    const { data: upserted, error: upErr } = await db
      .from('smartflo_call_recordings')
      .upsert(
        {
          smartflo_call_id: callId,
          client_number: phone10 ? `91${phone10}` : null,
          agent_number: String(rec.agent_number || '').trim() || null,
          did_number: didDigits || digitsOnly(rec.did_number) || null,
          direction: String(rec.direction || '').trim() || null,
          status: String(rec.status || '').trim() || null,
          call_duration: duration,
          answered_seconds: toInt(rec.answered_seconds),
          recording_url: skipCrmAttach ? recordingUrl : null,
          started_at: startedAt,
          ended_at: endedAt,
          lead_id: null,
          call_log_id: null,
          matched_at: null,
          source,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'smartflo_call_id' },
      )
      .select('id')
      .maybeSingle();
    if (upErr) console.warn('[smartfloCdr] light upsert:', upErr.message);
    if (skipCrmAttach) {
      await db
        .from('telecaller_call_logs')
        .update({ call_recording_url: null, smartflo_recording_synced_at: null })
        .eq('smartflo_call_id', callId);
    }
    return {
      recordingRowId: upserted?.id ? String(upserted.id) : null,
      callLogId: null,
      leadId: null,
      updatedLog: false,
      createdLog: false,
      hasRecording: false,
      skippedAttach: true,
    };
  }

  const fromDial = await findLeadFromDialSession(db, {
    callId,
    phone10,
    didNumber: didDigits,
    startedAt,
  });
  const leadId =
    fromDial.leadId ||
    (await findLeadIdFromSmartfloCallId(db, callId)) ||
    (phone10 ? await findLeadIdForPhone(db, phone10, opts?.leadCache) : null);
  const didForStore = didDigits || fromDial.didNumber || digitsOnly(rec.did_number) || null;

  const row: Record<string, unknown> = {
    smartflo_call_id: callId,
    client_number: phone10 ? `91${phone10}` : null,
    agent_number: String(rec.agent_number || '').trim() || null,
    did_number: didForStore,
    direction: String(rec.direction || '').trim() || null,
    status: String(rec.status || '').trim() || null,
    call_duration: duration,
    answered_seconds: toInt(rec.answered_seconds),
    recording_url: recordingUrl,
    started_at: startedAt,
    ended_at: endedAt,
    lead_id: leadId,
    source,
    updated_at: new Date().toISOString(),
  };
  if (!opts?.skipRaw) row.raw = rec as any;

  const { data: upserted, error: upErr } = await db
    .from('smartflo_call_recordings')
    .upsert(row, { onConflict: 'smartflo_call_id' })
    .select('id')
    .single();

  if (upErr) {
    console.warn('[smartfloCdr] upsert recording row:', upErr.message);
  }

  const attach = await findOrAttachCallLog({
    db,
    leadId,
    phone10,
    callId,
    recordingUrl,
    duration,
    startedAt,
    status: String(rec.status || ''),
    agentNumber: String(rec.agent_number || '').trim() || null,
    didNumber: didForStore,
  });

  if (upserted?.id && attach.callLogId) {
    await db
      .from('smartflo_call_recordings')
      .update({
        call_log_id: attach.callLogId,
        lead_id: leadId,
        matched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', upserted.id);
  }

  if (attach.newRecording && attach.callLogId) {
    enqueueCallIqOnRecordingCompleted(attach.callLogId, true);
    enqueueCrmDlOnRecordingCompleted(attach.callLogId);
  }

  return {
    recordingRowId: upserted?.id ? String(upserted.id) : null,
    callLogId: attach.callLogId,
    leadId,
    updatedLog: attach.updated,
    createdLog: attach.created,
    hasRecording,
    skippedAttach: false,
  };
}

/**
 * Fix CDRs that were wrongly collapsed onto one call log (pre-fix),
 * or that have recording_url but no matching telecaller_call_logs.smartflo_call_id.
 */
export async function repairDetachedSmartfloRecordings(limit = 200): Promise<{
  scanned: number;
  repaired: number;
  created_logs: number;
}> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { scanned: 0, repaired: 0, created_logs: 0 };
  const db = supabaseAdmin;

  const { data: rows } = await db
    .from('smartflo_call_recordings')
    .select(
      'id, smartflo_call_id, client_number, agent_number, did_number, recording_url, call_duration, started_at, ended_at, status, lead_id, call_log_id',
    )
    .not('recording_url', 'is', null)
    .neq('recording_url', '')
    .is('call_log_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  const list = Array.isArray(rows) ? rows : [];
  const pool = await ourDidPool();
  let repaired = 0;
  let created_logs = 0;

  for (const row of list) {
    const callId = String(row.smartflo_call_id || '').trim();
    const recordingUrl = String(row.recording_url || '').trim();
    if (!callId || !recordingUrl) continue;
    if (isExplicitForeignDid(row, pool)) continue;

    if (
      isBeforeSmartfloRecordingsCutoff(
        row.started_at ? String(row.started_at) : null,
        row.ended_at ? String(row.ended_at) : null,
      )
    ) {
      continue;
    }

    const { data: linked } = await db
      .from('telecaller_call_logs')
      .select('id, smartflo_call_id')
      .eq('smartflo_call_id', callId)
      .maybeSingle();

    if (linked?.id) {
      // Ensure CDR points at the correct log
      if (String(row.call_log_id || '') !== String(linked.id)) {
        await db
          .from('smartflo_call_recordings')
          .update({
            call_log_id: linked.id,
            matched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        repaired += 1;
      }
      continue;
    }

    // No call log for this Smartflo call_id → create / attach properly
    const phone10 = normalizePhone10(row.client_number);
    let leadId = String(row.lead_id || '').trim() || null;
    if (!leadId) leadId = await findLeadIdForPhone(db, phone10);

    const attach = await findOrAttachCallLog({
      db,
      leadId,
      phone10,
      callId,
      recordingUrl,
      duration: toInt(row.call_duration),
      startedAt: row.started_at ? String(row.started_at) : null,
      status: String(row.status || ''),
      agentNumber: String((row as any).agent_number || '').trim() || null,
      didNumber: String((row as any).did_number || '').trim() || null,
    });

    if (attach.callLogId) {
      if (attach.newRecording) {
        enqueueCallIqOnRecordingCompleted(attach.callLogId, true);
        enqueueCrmDlOnRecordingCompleted(attach.callLogId);
      }
      await db
        .from('smartflo_call_recordings')
        .update({
          call_log_id: attach.callLogId,
          lead_id: leadId,
          matched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      repaired += 1;
      if (attach.created) created_logs += 1;
    }
  }

  return { scanned: list.length, repaired, created_logs };
}

/** Attach stored CDRs onto CRM leads by customer phone (skip non-lead Smartflo traffic). */
export async function rematchSmartfloRecordingsToLeads(limit = 4000): Promise<{
  scanned: number;
  matched: number;
  attached: number;
}> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { scanned: 0, matched: 0, attached: 0 };
  const db = supabaseAdmin;
  const cutoffIso = smartfloRecordingsCutoffIso();
  const phoneIndex = await loadLeadPhoneIndex(db);
  const cap = Math.min(8000, Math.max(50, limit));
  const pageSize = 1000;
  const list: any[] = [];
  for (let from = 0; from < cap; from += pageSize) {
    const { data: rows } = await db
      .from('smartflo_call_recordings')
      .select(
        'id, smartflo_call_id, client_number, agent_number, did_number, recording_url, call_duration, started_at, status, lead_id, call_log_id',
      )
      .is('lead_id', null)
      .or(`started_at.gte.${cutoffIso},and(started_at.is.null,created_at.gte.${cutoffIso})`)
      .order('started_at', { ascending: false, nullsFirst: false })
      .range(from, from + pageSize - 1);
    const chunk = Array.isArray(rows) ? rows : [];
    list.push(...chunk);
    if (chunk.length < pageSize) break;
  }

  const byCallId = new Map<string, any>();
  const unmatchedByPhone: any[] = [];
  const pool = await ourDidPool();
  for (const row of list) {
    if (isExplicitForeignDid(row, pool)) continue;
    const phone10 = normalizePhone10(row.client_number);
    const agent10 = normalizePhone10(row.agent_number);
    const callId = String(row.smartflo_call_id || '').trim();
    const fromPhone =
      phone10 && phone10 !== agent10 && !isSmartfloLineNumber(phone10, pool)
        ? phoneIndex.get(phone10)
        : undefined;
    if (fromPhone) {
      byCallId.set(row.id, { row, leadId: fromPhone, phone10 });
    } else if (callId && phone10 && !isSmartfloLineNumber(phone10, pool)) {
      unmatchedByPhone.push(row);
    }
  }

  for (let i = 0; i < unmatchedByPhone.length; i += 80) {
    const chunk = unmatchedByPhone.slice(i, i + 80);
    const ids = chunk.map((r) => String(r.smartflo_call_id || '').trim()).filter(Boolean);
    if (!ids.length) continue;
    const { data: logs } = await db
      .from('telecaller_call_logs')
      .select('smartflo_call_id, lead_id')
      .in('smartflo_call_id', ids)
      .not('lead_id', 'is', null)
      .limit(80);
    const logMap = new Map(
      (Array.isArray(logs) ? logs : []).map((l: any) => [
        String(l.smartflo_call_id),
        String(l.lead_id),
      ]),
    );
    for (const row of chunk) {
      const callId = String(row.smartflo_call_id || '').trim();
      const leadId = logMap.get(callId);
      if (leadId) byCallId.set(row.id, { row, leadId, phone10: normalizePhone10(row.client_number) });
    }
  }

  const nowIso = new Date().toISOString();
  const updates = [...byCallId.values()];
  let matched = 0;
  let attached = 0;
  for (let i = 0; i < updates.length; i += 25) {
    const chunk = updates.slice(i, i + 25);
    await Promise.all(
      chunk.map(({ row, leadId }) =>
        db
          .from('smartflo_call_recordings')
          .update({
            lead_id: leadId,
            matched_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', row.id),
      ),
    );
    matched += chunk.length;
  }

  // Attach at most a handful of call logs so rematch cannot stall the page/sync.
  for (const { row, leadId, phone10 } of updates.slice(0, 40)) {
    const callId = String(row.smartflo_call_id || '').trim();
    if (!callId) continue;
    const attach = await findOrAttachCallLog({
      db,
      leadId,
      phone10,
      callId,
      recordingUrl: boundRecordingUrlForCallId(
        callId,
        String(row.recording_url || '').trim() || null,
      ),
      duration: toInt(row.call_duration),
      startedAt: row.started_at ? String(row.started_at) : null,
      status: String(row.status || ''),
      agentNumber: String(row.agent_number || '').trim() || null,
      didNumber: String((row as any).did_number || '').trim() || null,
    });
    if (attach.callLogId) {
      attached += 1;
      await db
        .from('smartflo_call_recordings')
        .update({ call_log_id: attach.callLogId, updated_at: nowIso })
        .eq('id', row.id);
    }
  }
  return { scanned: list.length, matched, attached };
}

/** Normalize webhook / loose payloads into a CDR-shaped record. */
export function normalizeWebhookPayload(body: Record<string, unknown>): SmartfloCdrRecord | null {
  if (!body || typeof body !== 'object') return null;

  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = body[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      // also try without $
      const bare = k.startsWith('$') ? k.slice(1) : k;
      const v2 = body[bare];
      if (v2 !== undefined && v2 !== null && String(v2).trim() !== '') return v2;
    }
    return null;
  };

  const callId = String(
    get('call_id', '$call_id', 'uuid', '$uuid', 'callId', 'id') || '',
  ).trim();
  const recordingUrl = String(
    get('recording_url', '$recording_url', 'recordingUrl', 'recording') || '',
  ).trim();
  const clientNumber = String(
    get(
      'client_number',
      '$client_number',
      'customer_number',
      '$customer_number',
      'customer_number_with_prefix',
      '$customer_number_with_prefix',
      'call_to_number',
      '$call_to_number',
      'destination',
      'to',
    ) || '',
  ).trim();

  if (!callId && !recordingUrl && !clientNumber) return null;

  return {
    call_id: callId || undefined,
    uuid: String(get('uuid', '$uuid') || '') || undefined,
    recording_url: recordingUrl || null,
    client_number: clientNumber || null,
    agent_number: String(get('agent_number', '$agent_number', 'agent') || '') || null,
    did_number: String(get('did_number', '$did_number', 'did', 'caller_id_number', '$caller_id_number') || '') || null,
    direction: String(get('direction', '$direction', 'call_direction') || '') || null,
    status: String(get('status', '$status', 'call_status', 'hangup_cause', '$hangup_cause') || '') || null,
    call_duration: get('call_duration', '$call_duration', 'duration', 'answered_seconds', '$answered_sec') as any,
    answered_seconds: get('answered_seconds', '$answered_sec') as any,
    end_stamp: String(get('end_stamp', '$end_stamp', 'hangup_time', '$hangup_time') || '') || undefined,
    date: String(get('date', '$date') || '') || undefined,
    time: String(get('time', '$time', 'start_time') || '') || undefined,
    hangup_cause: String(get('hangup_cause', '$hangup_cause') || '') || null,
    reason: String(get('reason', '$reason', 'reason_key', '$reason_key') || '') || null,
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Strip recording URLs from CRM call logs that started before the cutoff,
 * so already-synced older recordings disappear from Activity / Play.
 */
export async function detachPreCutoffSmartfloRecordings(): Promise<{
  cleared_logs: number;
  cleared_cdr_links: number;
}> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { cleared_logs: 0, cleared_cdr_links: 0 };
  const db = supabaseAdmin;
  const cutoffIso = new Date(smartfloRecordingsCutoffIso()).toISOString();

  const { data: cleared, error } = await db
    .from('telecaller_call_logs')
    .update({
      call_recording_url: null,
      smartflo_recording_synced_at: null,
    })
    .not('call_recording_url', 'is', null)
    .neq('call_recording_url', '')
    .lt('created_at', cutoffIso)
    .select('id');

  if (error) {
    console.warn('[smartfloCdr] detach pre-cutoff logs failed:', error.message);
  }

  const { data: oldCdr } = await db
    .from('smartflo_call_recordings')
    .select('id, call_log_id, smartflo_call_id, started_at, ended_at, created_at')
    .not('recording_url', 'is', null)
    .neq('recording_url', '')
    .or(`started_at.lt.${cutoffIso},and(started_at.is.null,created_at.lt.${cutoffIso})`)
    .limit(2000);

  let cleared_cdr_links = 0;
  for (const row of Array.isArray(oldCdr) ? oldCdr : []) {
    if (
      !isBeforeSmartfloRecordingsCutoff(
        row.started_at ? String(row.started_at) : null,
        row.ended_at ? String(row.ended_at) : null,
        row.created_at ? String(row.created_at) : null,
      )
    ) {
      continue;
    }
    const logId = String(row.call_log_id || '').trim();
    const callId = String(row.smartflo_call_id || '').trim();
    if (logId) {
      await db
        .from('telecaller_call_logs')
        .update({ call_recording_url: null, smartflo_recording_synced_at: null })
        .eq('id', logId);
    }
    if (callId) {
      await db
        .from('telecaller_call_logs')
        .update({ call_recording_url: null, smartflo_recording_synced_at: null })
        .eq('smartflo_call_id', callId);
    }
    await db
      .from('smartflo_call_recordings')
      .update({
        call_log_id: null,
        matched_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    cleared_cdr_links += 1;
  }

  return {
    cleared_logs: Array.isArray(cleared) ? cleared.length : 0,
    cleared_cdr_links,
  };
}

let lastForeignDetachAt = 0;

/**
 * Remove CRM attachments for Smartflo calls that did not use the MyFNG 5-DID pool
 * (other agents / inbound on unrelated Tata numbers).
 */
export async function detachForeignDidRecordings(): Promise<{
  cleared_logs: number;
  unlinked_cdrs: number;
}> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { cleared_logs: 0, unlinked_cdrs: 0 };
  const db = supabaseAdmin;
  const pool = await ourDidPool();
  if (!pool.size) return { cleared_logs: 0, unlinked_cdrs: 0 };

  const { data: rows } = await db
    .from('smartflo_call_recordings')
    .select('id, did_number, agent_number, call_log_id, smartflo_call_id, lead_id')
    .or('lead_id.not.is.null,call_log_id.not.is.null')
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(2500);

  const foreign = (Array.isArray(rows) ? rows : []).filter((r: any) => isExplicitForeignDid(r, pool));
  if (!foreign.length) return { cleared_logs: 0, unlinked_cdrs: 0 };

  const logIds = [
    ...new Set(
      foreign
        .map((r: any) => String(r.call_log_id || '').trim())
        .filter(Boolean),
    ),
  ];
  const callIds = [
    ...new Set(
      foreign
        .map((r: any) => String(r.smartflo_call_id || '').trim())
        .filter(Boolean),
    ),
  ];
  const cdrIds = foreign.map((r: any) => String(r.id)).filter(Boolean);

  let cleared_logs = 0;
  for (let i = 0; i < logIds.length; i += 80) {
    const chunk = logIds.slice(i, i + 80);
    const { data } = await db
      .from('telecaller_call_logs')
      .update({ call_recording_url: null, smartflo_recording_synced_at: null })
      .in('id', chunk)
      .select('id');
    cleared_logs += Array.isArray(data) ? data.length : 0;
  }
  for (let i = 0; i < callIds.length; i += 80) {
    const chunk = callIds.slice(i, i + 80);
    const { data } = await db
      .from('telecaller_call_logs')
      .update({ call_recording_url: null, smartflo_recording_synced_at: null })
      .in('smartflo_call_id', chunk)
      .select('id');
    cleared_logs += Array.isArray(data) ? data.length : 0;
  }
  for (let i = 0; i < cdrIds.length; i += 80) {
    const chunk = cdrIds.slice(i, i + 80);
    await db
      .from('smartflo_call_recordings')
      .update({
        lead_id: null,
        call_log_id: null,
        matched_at: null,
        updated_at: new Date().toISOString(),
      })
      .in('id', chunk);
  }

  return { cleared_logs, unlinked_cdrs: cdrIds.length };
}

export async function detachForeignDidRecordingsThrottled(): Promise<void> {
  if (Date.now() - lastForeignDetachAt < 45_000) return;
  lastForeignDetachAt = Date.now();
  try {
    await detachForeignDidRecordings();
  } catch (e) {
    lastForeignDetachAt = 0;
    console.warn('[smartfloCdr] detach foreign DID failed:', e);
  }
}

/** Immediate: strip non-pool recordings from one lead's call history (lead drawer). */
export async function detachForeignDidRecordingsForLead(leadId: string): Promise<void> {
  const id = String(leadId || '').trim();
  if (!id) return;
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return;
  const pool = await ourDidPool();
  if (!pool.size) return;

  const { data: rows } = await supabaseAdmin
    .from('smartflo_call_recordings')
    .select('id, did_number, agent_number, call_log_id, smartflo_call_id')
    .eq('lead_id', id)
    .limit(80);

  const foreign = (Array.isArray(rows) ? rows : []).filter((r: any) => isExplicitForeignDid(r, pool));
  if (!foreign.length) return;

  const logIds = foreign.map((r: any) => String(r.call_log_id || '').trim()).filter(Boolean);
  const callIds = foreign.map((r: any) => String(r.smartflo_call_id || '').trim()).filter(Boolean);
  const cdrIds = foreign.map((r: any) => String(r.id)).filter(Boolean);

  if (logIds.length) {
    await supabaseAdmin
      .from('telecaller_call_logs')
      .update({ call_recording_url: null, smartflo_recording_synced_at: null })
      .in('id', logIds);
  }
  if (callIds.length) {
    await supabaseAdmin
      .from('telecaller_call_logs')
      .update({ call_recording_url: null, smartflo_recording_synced_at: null })
      .in('smartflo_call_id', callIds)
      .eq('lead_id', id);
  }
  if (cdrIds.length) {
    await supabaseAdmin
      .from('smartflo_call_recordings')
      .update({
        lead_id: null,
        call_log_id: null,
        matched_at: null,
        updated_at: new Date().toISOString(),
      })
      .in('id', cdrIds);
  }
}

const leadHealAt = new Map<string, number>();
const leadHealInflight = new Map<string, Promise<{ attached: number }>>();

function dbRowToCdr(row: any): SmartfloCdrRecord {
  return {
    call_id: String(row.smartflo_call_id || ''),
    client_number: row.client_number,
    customer_number: row.client_number,
    agent_number: row.agent_number,
    did_number: row.did_number,
    direction: row.direction,
    status: row.status,
    call_duration: row.call_duration,
    answered_seconds: row.answered_seconds,
    recording_url: row.recording_url,
    started_at: row.started_at,
    end_stamp: row.ended_at,
  };
}

/**
 * When a lead is opened: attach stored / Tata click-to-call audio onto RINGING stubs.
 * Tata often omits did_number on click-to-call; we still match by customer phone.
 */
export async function healSmartfloRecordingForLead(leadId: string): Promise<{ attached: number }> {
  const id = String(leadId || '').trim();
  if (!id) return { attached: 0 };
  const inflight = leadHealInflight.get(id);
  if (inflight) return inflight;
  const last = leadHealAt.get(id) || 0;
  if (Date.now() - last < 90_000) return { attached: 0 };
  leadHealAt.set(id, Date.now());

  const run = doHealSmartfloRecordingForLead(id);
  leadHealInflight.set(id, run);
  try {
    const result = await run;
    if (!result.attached) leadHealAt.delete(id);
    return result;
  } finally {
    leadHealInflight.delete(id);
  }
}

async function doHealSmartfloRecordingForLead(id: string): Promise<{ attached: number }> {

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { attached: 0 };
  const db = supabaseAdmin;
  const pool = await ourDidPool();

  const { data: lead } = await db
    .from('service_leads')
    .select('id, customer_phone, customer_alternate_phone, created_at')
    .eq('id', id)
    .maybeSingle();
  if (!lead) return { attached: 0 };

  const phones = [
    ...new Set(
      [normalizePhone10(lead.customer_phone), normalizePhone10(lead.customer_alternate_phone)].filter(
        (p): p is string => Boolean(p),
      ),
    ),
  ];
  if (!phones.length) return { attached: 0 };

  let attached = 0;
  for (const p of phones) {
    const { data: cdrs } = await db
      .from('smartflo_call_recordings')
      .select(
        'id, smartflo_call_id, client_number, agent_number, did_number, direction, status, call_duration, answered_seconds, recording_url, started_at, ended_at',
      )
      .or(`client_number.eq.${p},client_number.eq.91${p},client_number.eq.+91${p},client_number.ilike.%${p}`)
      .order('started_at', { ascending: false, nullsFirst: false })
      .limit(20);
    for (const row of Array.isArray(cdrs) ? cdrs : []) {
      if (isExplicitForeignDid(row, pool)) continue;
      const r = await upsertSmartfloRecording(dbRowToCdr(row), 'cdr', {
        onlyAttachIfRecording: false,
        skipRaw: true,
      });
      if (r.callLogId && r.hasRecording) attached += 1;
    }
  }

  const { data: logs } = await db
    .from('telecaller_call_logs')
    .select('id, call_recording_url, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(80);

  const token = await getSmartfloApiToken();
  if (!token) return { attached };

  const now = Date.now();
  const leadCreatedMs = Date.parse(String((lead as any).created_at || ''));
  const cutoffMs = Date.parse(smartfloRecordingsCutoffIso());
  let fromMs = Number.isFinite(cutoffMs) ? cutoffMs : now - 14 * 24 * 60 * 60 * 1000;
  if (Number.isFinite(leadCreatedMs) && leadCreatedMs > fromMs) fromMs = leadCreatedMs;
  for (const l of Array.isArray(logs) ? logs : []) {
    const t = Date.parse(String(l.created_at || ''));
    if (Number.isFinite(t) && t < fromMs) fromMs = t;
  }
  const winFrom = formatSmartfloDateTime(new Date(fromMs));
  const winTo = formatSmartfloDateTime(new Date(now));

  const phoneList = [...phones];
  const queries: { label: string; callerid?: string }[] = [];
  for (const p of phoneList) {
    queries.push({ label: `callerid=91${p}`, callerid: `91${p}` });
  }

  let fetched = 0;
  const seen = new Set<string>();
  for (const q of queries) {
    const batch = await fetchCdrPages({
      token,
      fromDate: winFrom,
      toDate: winTo,
      maxPages: 6,
      timeoutMs: 16_000,
      callerid: q.callerid,
    });
    fetched += batch.results.length;
    const hits = batch.results.filter((rec) => {
      if (isExplicitForeignDid(rec, pool)) return false;
      return phoneList.some((p) => cdrMentionsPhone(rec, p));
    });
    console.warn('[smartflo-heal] query', {
      id,
      q: q.label,
      from: winFrom,
      to: winTo,
      ok: batch.ok,
      error: batch.error,
      rows: batch.results.length,
      phoneHits: hits.length,
      sample: cdrSample(batch.results[0]),
    });
    for (const rec of hits) {
      const cid = pickCallId(rec) || '';
      if (cid && seen.has(cid)) continue;
      if (cid) seen.add(cid);
      const r = await upsertSmartfloRecording(rec, 'cdr', {
        onlyAttachIfRecording: false,
        skipRaw: true,
      });
      console.warn('[smartflo-heal] match', {
        callId: pickCallId(rec),
        phone: pickCdrCustomerNumber(rec, pool),
        did: rec.did_number,
        attached: Boolean(r.callLogId && r.hasRecording),
        skipped: r.skippedAttach,
        recording: r.hasRecording,
      });
      if (r.callLogId && r.hasRecording) attached += 1;
      else if (r.callLogId) attached += 1;
    }
  }
  console.warn('[smartflo-heal] done', { id, phones, from: winFrom, to: winTo, fetched, attached });

  return { attached };
}

let assignedC2cHealInflight: Promise<{
  leads: number;
  phones: number;
  fetched: number;
  attached: number;
}> | null = null;

/**
 * Pull every Click-to-Call CDR for leads assigned to Mahendra / Ajit (DID owners)
 * and attach all recordings (today + later calls on the same lead).
 */
export async function healClickToCallRecordingsForAssignedLeads(input?: {
  timeBudgetMs?: number;
}): Promise<{ leads: number; phones: number; fetched: number; attached: number }> {
  if (assignedC2cHealInflight) return assignedC2cHealInflight;
  const run = doHealClickToCallRecordingsForAssignedLeads(input);
  assignedC2cHealInflight = run;
  try {
    return await run;
  } finally {
    assignedC2cHealInflight = null;
  }
}

async function doHealClickToCallRecordingsForAssignedLeads(input?: {
  timeBudgetMs?: number;
}): Promise<{ leads: number; phones: number; fetched: number; attached: number }> {
  const started = Date.now();
  const timeBudgetMs = Math.min(90_000, Math.max(8_000, input?.timeBudgetMs ?? 40_000));
  const empty = { leads: 0, phones: 0, fetched: 0, attached: 0 };
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return empty;
  const token = await getSmartfloApiToken();
  if (!token) return empty;

  const cfg = await clickToCallConfigCached();
  const ownerIds = [
    ...new Set(
      (cfg.did_assignments || []).map((a) => String(a.telecaller_id || '').trim()).filter(Boolean),
    ),
  ];
  if (!ownerIds.length) return empty;

  const { data: leads } = await supabaseAdmin
    .from('service_leads')
    .select('id, customer_phone, customer_alternate_phone')
    .in('assigned_telecaller_id', ownerIds)
    .limit(4000);
  const list = Array.isArray(leads) ? leads : [];
  const pool = await ourDidPool();
  const phoneToLead = new Map<string, string>();
  for (const lead of list) {
    const id = String(lead.id || '').trim();
    if (!id) continue;
    for (const raw of [lead.customer_phone, lead.customer_alternate_phone]) {
      const p = normalizePhone10(raw);
      if (p && !phoneToLead.has(p)) phoneToLead.set(p, id);
    }
  }

  const phones = [...phoneToLead.keys()];
  const fromDate = smartfloRecordingsMinFrom();
  const toDate = formatSmartfloDateTime(new Date());
  const leadCache = new Map<string, string | null>();
  const seen = new Set<string>();
  let fetched = 0;
  let attached = 0;

  const assignedLeadIds = [...new Set(phoneToLead.values())];
  const haveLead = new Set<string>();
  if (assignedLeadIds.length) {
    const { data: existing } = await supabaseAdmin
      .from('smartflo_call_recordings')
      .select('lead_id')
      .in('lead_id', assignedLeadIds.slice(0, 1000))
      .limit(4000);
    for (const row of Array.isArray(existing) ? existing : []) {
      const id = String((row as any).lead_id || '').trim();
      if (id) haveLead.add(id);
    }
  }

  const calledFirst: string[] = [];
  const rest: string[] = [];
  if (assignedLeadIds.length) {
    const { data: logs } = await supabaseAdmin
      .from('telecaller_call_logs')
      .select('lead_id, phone_number')
      .in('lead_id', assignedLeadIds.slice(0, 1000))
      .gte('created_at', smartfloRecordingsCutoffIso())
      .limit(5000);
    const calledLeads = new Set<string>();
    for (const row of Array.isArray(logs) ? logs : []) {
      const id = String((row as any).lead_id || '').trim();
      if (id) calledLeads.add(id);
    }
    for (const phone of phones) {
      const leadId = phoneToLead.get(phone) || '';
      if (haveLead.has(leadId)) continue;
      if (calledLeads.has(leadId)) calledFirst.push(phone);
      else rest.push(phone);
    }
  } else {
    rest.push(...phones);
  }

  const work = [...calledFirst, ...rest];
  const leftover = await mapPool(work, 5, async (phone) => {
    if (Date.now() - started > timeBudgetMs - 2_000) return { fetched: 0, attached: 0 };
    const batch = await fetchCdrPages({
      token,
      fromDate,
      toDate,
      maxPages: 2,
      timeoutMs: 12_000,
      callerid: `91${phone}`,
    });
    let n = 0;
    for (const rec of batch.results || []) {
      if (isExplicitForeignDid(rec, pool)) continue;
      if (!cdrMentionsPhone(rec, phone)) continue;
      const cid = pickCallId(rec) || '';
      if (cid && seen.has(cid)) continue;
      if (cid) seen.add(cid);
      const r = await upsertSmartfloRecording(rec, 'cdr', {
        leadCache,
        onlyAttachIfRecording: false,
        skipRaw: true,
      });
      if (r.callLogId) n += 1;
    }
    return { fetched: batch.results.length, attached: n };
  });
  fetched += leftover.reduce((n, o) => n + (o?.fetched || 0), 0);
  attached += leftover.reduce((n, o) => n + (o?.attached || 0), 0);

  console.warn('[smartflo-heal] assigned-c2c', {
    leads: list.length,
    phones: phones.length,
    queued: work.length,
    called_first: calledFirst.length,
    fetched,
    attached,
    elapsed_ms: Date.now() - started,
  });
  return { leads: list.length, phones: phones.length, fetched, attached };
}

export async function syncSmartfloRecordings(input?: {
  hoursBack?: number;
  fromDate?: string;
  toDate?: string;
  maxPages?: number;
  /** Soft deadline — return partial success instead of hanging */
  timeBudgetMs?: number;
  concurrency?: number;
  /** Cron path: skip heavy repair/detach so the tick can finish inside Vercel maxDuration */
  skipPostProcess?: boolean;
}): Promise<SyncSmartfloRecordingsResult> {
  const started = Date.now();
  const token = await getSmartfloApiToken();
  if (!token) {
    return {
      ok: false,
      error: 'Smartflo API token missing. Save c2c token under Click to Call setup.',
      fetched: 0,
      upserted: 0,
      matched: 0,
      updated_logs: 0,
      created_logs: 0,
      with_recording: 0,
      from_date: '',
      to_date: '',
      pages: 0,
      elapsed_ms: Date.now() - started,
    };
  }

  const hoursBack = Math.min(240, Math.max(1, input?.hoursBack ?? 6));
  const to = input?.toDate || formatSmartfloDateTime(new Date());
  const minFrom = smartfloRecordingsMinFrom();
  let from =
    input?.fromDate ||
    formatSmartfloDateTime(new Date(Date.now() - hoursBack * 60 * 60 * 1000));
  // Never request / sync CDR earlier than product cutoff (22 Aug 2026 IST)
  if (from < minFrom) from = minFrom;
  if (to < minFrom) {
    return {
      ok: true,
      fetched: 0,
      upserted: 0,
      matched: 0,
      updated_logs: 0,
      created_logs: 0,
      with_recording: 0,
      from_date: minFrom,
      to_date: to,
      pages: 0,
      elapsed_ms: Date.now() - started,
    };
  }

  const maxPages = Math.min(20, Math.max(1, input?.maxPages ?? 3));
  const timeBudgetMs = Math.min(300_000, Math.max(15_000, input?.timeBudgetMs ?? 55_000));
  const concurrency = Math.min(10, Math.max(2, input?.concurrency ?? 6));
  const leadCache = new Map<string, string | null>();

  let fetched = 0;
  let upserted = 0;
  let matched = 0;
  let updated_logs = 0;
  let created_logs = 0;
  let with_recording = 0;
  let pages = 0;
  let truncated = false;

  const poolDids = [...(await ourDidPool())];
  const didQueries = poolDids.length
    ? poolDids.map((d) => (d.length === 10 ? `91${d}` : d))
    : [null as string | null];

  didLoop: for (const didNumber of didQueries) {
  let page = 1;
  while (page <= maxPages) {
    if (Date.now() - started > timeBudgetMs) {
      truncated = true;
      break didLoop;
    }

    const batch = await fetchSmartfloCallRecords({
      token,
      fromDate: from,
      toDate: to,
      page,
      limit: 50,
      timeoutMs: 18000,
      didNumber,
    });
    if (!batch.ok) {
      if (page === 1 && didQueries.length === 1) {
        return {
          ok: false,
          error: batch.error || 'CDR fetch failed',
          fetched,
          upserted,
          matched,
          updated_logs,
          created_logs,
          with_recording,
          from_date: from,
          to_date: to,
          pages,
          elapsed_ms: Date.now() - started,
        };
      }
      if (page === 1) {
        console.warn('[smartflo-sync] DID fetch failed', didNumber, batch.error);
        continue didLoop;
      }
      truncated = true;
      break;
    }

    pages += 1;
    const results = batch.results || [];
    fetched += results.length;
    if (!results.length) break;

    // Prefer rows with recording_url first (CRM Play needs these)
    const ordered = [...results].sort((a, b) => {
      const ar = String(a.recording_url || '').trim() ? 1 : 0;
      const br = String(b.recording_url || '').trim() ? 1 : 0;
      return br - ar;
    });

    const outcomes = await mapPool(ordered, concurrency, async (rec) => {
      if (Date.now() - started > timeBudgetMs) {
        return null;
      }
      return upsertSmartfloRecording(rec, 'cdr', {
        leadCache,
        onlyAttachIfRecording: input?.skipPostProcess ? true : false,
        skipRaw: true,
      });
    });

    for (const r of outcomes) {
      if (!r) {
        truncated = true;
        continue;
      }
      if (r.recordingRowId) upserted += 1;
      if (r.hasRecording) with_recording += 1;
      if (r.callLogId) matched += 1;
      if (r.updatedLog) updated_logs += 1;
      if (r.createdLog) created_logs += 1;
    }

    if (Date.now() - started > timeBudgetMs) {
      truncated = true;
      break didLoop;
    }
    if (results.length < 50) break;
    page += 1;
  }
  }

  // Heal: re-attach stored CDRs that never linked to a call log (RINGING stubs, late audio)
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (supabaseAdmin) {
      const sinceIso = input?.fromDate
        ? smartfloRecordingsCutoffIso()
        : new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      const { data: orphans } = await supabaseAdmin
        .from('smartflo_call_recordings')
        .select('*')
        .is('call_log_id', null)
        .not('recording_url', 'is', null)
        .or(`started_at.gte.${sinceIso},and(started_at.is.null,created_at.gte.${sinceIso})`)
        .order('started_at', { ascending: false, nullsFirst: false })
        .limit(200);
      for (const row of orphans || []) {
        if (Date.now() - started > timeBudgetMs) break;
        const rec: SmartfloCdrRecord = {
          call_id: String((row as any).smartflo_call_id || ''),
          client_number: (row as any).client_number,
          agent_number: (row as any).agent_number,
          did_number: (row as any).did_number,
          direction: (row as any).direction,
          status: (row as any).status,
          call_duration: (row as any).call_duration,
          answered_seconds: (row as any).answered_seconds,
          recording_url: (row as any).recording_url,
          date: (row as any).started_at,
        };
        if (!rec.call_id) continue;
        const r = await upsertSmartfloRecording(rec, 'cdr', {
          leadCache,
          onlyAttachIfRecording: false,
          skipRaw: true,
        });
        if (r.callLogId) matched += 1;
        if (r.updatedLog) updated_logs += 1;
        if (r.createdLog) created_logs += 1;
        if (r.hasRecording) with_recording += 1;
      }
    }
  } catch (e) {
    console.warn('[smartfloCdr] orphan heal failed:', e);
  }

  // Match stored CDRs onto CRM leads only, then create missing call logs.
  try {
    const rematch = await rematchSmartfloRecordingsToLeads(4000);
    matched += rematch.attached;
  } catch (e) {
    console.warn('[smartfloCdr] rematch leads failed:', e);
  }

  // Always attach stored audio that never got a call log (Recordings page lists call logs).
  let repair = { scanned: 0, repaired: 0, created_logs: 0 };
  try {
    repair = await repairDetachedSmartfloRecordings(input?.skipPostProcess ? 500 : 300);
    created_logs += repair.created_logs;
  } catch (e) {
    console.warn('[smartfloCdr] repair failed:', e);
  }

  let detach = { cleared_logs: 0, cleared_cdr_links: 0 };
  try {
    const foreign = await detachForeignDidRecordings();
    detach.cleared_logs += foreign.cleared_logs;
    detach.cleared_cdr_links += foreign.unlinked_cdrs;
  } catch (e) {
    console.warn('[smartfloCdr] detach foreign DID failed:', e);
  }
  if (!input?.skipPostProcess) {
    try {
      const pre = await detachPreCutoffSmartfloRecordings();
      detach.cleared_logs += pre.cleared_logs;
      detach.cleared_cdr_links += pre.cleared_cdr_links;
    } catch (e) {
      console.warn('[smartfloCdr] detach pre-cutoff failed:', e);
    }
  }

  return {
    ok: true,
    fetched,
    upserted,
    matched,
    updated_logs,
    created_logs,
    with_recording,
    from_date: from,
    to_date: to,
    pages,
    truncated,
    elapsed_ms: Date.now() - started,
    repair,
    detach,
  };
}

/** First calendar day to backfill after the 22–23 Aug batch already on Recordings. */
export const SMARTFLO_RECORDINGS_AFTER_AUG23_IST = '2026-08-20';

function istYmdListInclusive(fromYmd: string, toYmd: string): string[] {
  const start = Date.parse(`${fromYmd}T00:00:00+05:30`);
  const end = Date.parse(`${toYmd}T00:00:00+05:30`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const days: string[] = [];
  for (let t = start; t <= end; t += 24 * 60 * 60 * 1000) {
    days.push(formatSmartfloDateTime(new Date(t)).slice(0, 10));
  }
  return days;
}

/**
 * Pull Smartflo CDRs day-by-day (avoids API range caps) and attach recording URLs
 * onto lead call logs. Newest days first so fresh recordings land even if time runs out.
 */
export async function backfillSmartfloRecordingsFromIst(
  startYmd: string,
  input?: {
    timeBudgetMs?: number;
    skipPostProcess?: boolean;
    newestFirst?: boolean;
  },
): Promise<SyncSmartfloRecordingsResult & { days_ok: number; days_total: number; days_done: string[] }> {
  const started = Date.now();
  const timeBudgetMs = Math.min(900_000, Math.max(20_000, input?.timeBudgetMs ?? 180_000));
  const todayYmd = formatSmartfloDateTime(new Date()).slice(0, 10);
  const fromYmd = startYmd < SMARTFLO_RECORDINGS_CUTOFF_IST ? SMARTFLO_RECORDINGS_CUTOFF_IST : startYmd;
  let days = istYmdListInclusive(fromYmd, todayYmd);
  if (input?.newestFirst !== false) days = days.reverse();

  const empty: SyncSmartfloRecordingsResult & { days_ok: number; days_total: number; days_done: string[] } = {
    ok: true,
    fetched: 0,
    upserted: 0,
    matched: 0,
    updated_logs: 0,
    created_logs: 0,
    with_recording: 0,
    from_date: `${fromYmd} 00:00:00`,
    to_date: `${todayYmd} 23:59:59`,
    pages: 0,
    truncated: false,
    elapsed_ms: 0,
    days_ok: 0,
    days_total: days.length,
    days_done: [],
  };

  if (!days.length) {
    empty.elapsed_ms = Date.now() - started;
    return empty;
  }

  const acc = { ...empty };
  for (const ymd of days) {
    if (Date.now() - started > timeBudgetMs - 8_000) {
      acc.truncated = true;
      break;
    }
    const remaining = timeBudgetMs - (Date.now() - started);
    const dayRes = await syncSmartfloRecordings({
      fromDate: `${ymd} 00:00:00`,
      toDate: `${ymd} 23:59:59`,
      maxPages: 20,
      timeBudgetMs: Math.min(90_000, Math.max(20_000, remaining - 5_000)),
      concurrency: 6,
      skipPostProcess: input?.skipPostProcess !== false,
    });
    acc.ok = acc.ok && dayRes.ok;
    if (!dayRes.ok && !acc.error) acc.error = dayRes.error;
    acc.fetched += dayRes.fetched;
    acc.upserted += dayRes.upserted;
    acc.matched += dayRes.matched;
    acc.updated_logs += dayRes.updated_logs;
    acc.created_logs += dayRes.created_logs;
    acc.with_recording += dayRes.with_recording;
    acc.pages += dayRes.pages;
    if (dayRes.truncated) acc.truncated = true;
    if (dayRes.ok) acc.days_ok += 1;
    acc.days_done.push(ymd);
  }

  try {
    const rematch = await rematchSmartfloRecordingsToLeads(4000);
    acc.matched += rematch.attached;
  } catch (e) {
    console.warn('[smartfloCdr] backfill rematch failed:', e);
  }

  acc.elapsed_ms = Date.now() - started;
  return acc;
}

/** Fetch audio bytes for a stored recording URL (Bearer fallback). */
export async function fetchRecordingAudio(
  recordingUrl: string,
): Promise<{ ok: boolean; status: number; contentType: string; body: ArrayBuffer; error?: string }> {
  const token = await getSmartfloApiToken();
  const headers: Record<string, string> = {
    Accept: '*/*',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(recordingUrl, {
    method: 'GET',
    headers,
    cache: 'no-store',
    redirect: 'follow',
  });

  if (!res.ok) {
    // Retry without auth — some URLs are token-in-query only
    if (token) {
      const res2 = await fetch(recordingUrl, {
        method: 'GET',
        headers: { Accept: '*/*' },
        cache: 'no-store',
        redirect: 'follow',
      });
      if (res2.ok) {
        const body = await res2.arrayBuffer();
        return {
          ok: true,
          status: res2.status,
          contentType: res2.headers.get('content-type') || 'audio/mpeg',
          body,
        };
      }
    }
    const text = await res.text().catch(() => '');
    return {
      ok: false,
      status: res.status,
      contentType: 'text/plain',
      body: new ArrayBuffer(0),
      error: text || `Recording fetch failed (${res.status})`,
    };
  }

  const body = await res.arrayBuffer();
  return {
    ok: true,
    status: res.status,
    contentType: res.headers.get('content-type') || 'audio/mpeg',
    body,
  };
}
