/**
 * Smartflo CDR client + match recordings onto CRM call logs / leads.
 * Auth: Bearer token from Click-to-Call settings (smartflo_api_token / SMARTFLO_API_TOKEN).
 */

import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getClickToCallConfig } from '@/lib/telecaller/clickToCallConfig';
import { normalizePhone10 } from '@/lib/telecaller/initiateClickToCall';

export const SMARTFLO_API_BASE = 'https://api-smartflo.tatateleservices.com/v1';

/**
 * Only sync/attach call recordings on/after this IST calendar day.
 * Older Smartflo CDRs are ignored (and detached from CRM call logs).
 */
export const SMARTFLO_RECORDINGS_CUTOFF_IST = '2026-08-22';

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

function toInt(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
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

function pickCallId(rec: SmartfloCdrRecord): string | null {
  const id = String(rec.call_id || rec.uuid || rec.id || '').trim();
  return id || null;
}

async function findLeadIdForPhone(
  db: any,
  phone10: string | null,
  cache?: Map<string, string | null>,
): Promise<string | null> {
  if (!phone10) return null;
  if (cache?.has(phone10)) return cache.get(phone10) ?? null;

  // Exact variants first (fast) — avoid expensive ilike scan unless needed
  const { data: exactRows } = await db
    .from('service_leads')
    .select('id, customer_phone, updated_at')
    .or(
      `customer_phone.eq.${phone10},customer_phone.eq.91${phone10},customer_phone.eq.+91${phone10},customer_phone.eq.0${phone10}`,
    )
    .order('updated_at', { ascending: false })
    .limit(5);

  let rows = Array.isArray(exactRows) ? exactRows : [];
  if (!rows.length) {
    const { data: fuzzy } = await db
      .from('service_leads')
      .select('id, customer_phone, updated_at')
      .like('customer_phone', `%${phone10}`)
      .order('updated_at', { ascending: false })
      .limit(5);
    rows = Array.isArray(fuzzy) ? fuzzy : [];
  }

  const exact = rows.find((r: any) => normalizePhone10(r.customer_phone) === phone10);
  const leadId = String((exact || rows[0])?.id || '').trim() || null;
  cache?.set(phone10, leadId);
  return leadId;
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
}): Promise<{ callLogId: string | null; updated: boolean; created: boolean }> {
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
      if (recordingUrl && !byId.call_recording_url) patch.call_recording_url = recordingUrl;
      if (duration != null) patch.call_duration = duration;
      await db.from('telecaller_call_logs').update(patch).eq('id', byId.id);
      return { callLogId: String(byId.id), updated: true, created: false };
    }
  }

  // 2) Attach only to a *pending* dial log (no Smartflo id yet, no recording yet).
  // Never reuse a log that already has another smartflo_call_id / recording —
  // that was overwriting call #1 when call #2 synced.
  if (leadId || phone10) {
    const center = startedAt ? new Date(startedAt).getTime() : Date.now();
    const fromIso = new Date(center - 6 * 60 * 60 * 1000).toISOString();
    const toIso = new Date(center + 2 * 60 * 60 * 1000).toISOString();

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
      return { callLogId: String(hit.id), updated: true, created: false };
    }
  }

  // 3) New Smartflo call_id → create log when we have recording OR answered duration
  if (leadId && (recordingUrl || (duration != null && duration > 0))) {
    const statusUpper = String(status || '').toUpperCase();
    const callStatus =
      statusUpper.includes('ANSWER') || statusUpper === 'ANSWERED' || (duration != null && duration > 0)
        ? 'ANSWERED'
        : statusUpper.includes('MISS') || statusUpper.includes('NO_ANSWER')
          ? 'NO_ANSWER'
          : 'COMPLETED';

    const { data: lead } = await db
      .from('service_leads')
      .select('id, assigned_telecaller_id')
      .eq('id', leadId)
      .maybeSingle();

    let telecallerId = String(lead?.assigned_telecaller_id || '').trim() || null;
    if (!telecallerId) {
      const { data: prev } = await db
        .from('telecaller_call_logs')
        .select('telecaller_id')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      telecallerId = String(prev?.telecaller_id || '').trim() || null;
    }
    if (!telecallerId) {
      return { callLogId: null, updated: false, created: false };
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
      return { callLogId: null, updated: false, created: false };
    }
    return { callLogId: String(inserted.id), updated: false, created: true };
  }

  return { callLogId: null, updated: false, created: false };
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

  const phone10 = normalizePhone10(rec.client_number);
  const recordingUrl = String(rec.recording_url || '').trim() || null;
  const duration = toInt(rec.call_duration) ?? toInt(rec.answered_seconds);
  const { startedAt, endedAt } = parseSmartfloStamp(rec);
  const hasRecording = Boolean(recordingUrl);
  const onlyAttachIfRecording = opts?.onlyAttachIfRecording !== false;

  // Hard product cutoff: ignore recordings before 22 Aug 2026 (IST)
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

  // Fast path: no audio AND no useful outcome → skip expensive lead/log matching.
  // CDRs with duration/answered/missed must still heal pending RINGING stubs.
  const statusStr = String(rec.status || rec.hangup_cause || '');
  const meaningfulOutcome =
    (duration != null && duration > 0) ||
    /answer|miss|no[_\s-]?answer|not[_\s-]?connected|completed|hangup/i.test(statusStr);

  if (onlyAttachIfRecording && !hasRecording && !meaningfulOutcome) {
    const { data: upserted, error: upErr } = await db
      .from('smartflo_call_recordings')
      .upsert(
        {
          smartflo_call_id: callId,
          client_number: digitsOnly(rec.client_number) || null,
          agent_number: String(rec.agent_number || '').trim() || null,
          did_number: digitsOnly(rec.did_number) || null,
          direction: String(rec.direction || '').trim() || null,
          status: String(rec.status || '').trim() || null,
          call_duration: duration,
          answered_seconds: toInt(rec.answered_seconds),
          recording_url: null,
          started_at: startedAt,
          ended_at: endedAt,
          source,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'smartflo_call_id' },
      )
      .select('id')
      .maybeSingle();
    if (upErr) console.warn('[smartfloCdr] light upsert:', upErr.message);
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

  const leadId = await findLeadIdForPhone(db, phone10, opts?.leadCache);

  const row: Record<string, unknown> = {
    smartflo_call_id: callId,
    client_number: digitsOnly(rec.client_number) || null,
    agent_number: String(rec.agent_number || '').trim() || null,
    did_number: digitsOnly(rec.did_number) || null,
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
      'id, smartflo_call_id, client_number, recording_url, call_duration, started_at, ended_at, status, lead_id, call_log_id',
    )
    .not('recording_url', 'is', null)
    .neq('recording_url', '')
    .order('created_at', { ascending: false })
    .limit(limit);

  const list = Array.isArray(rows) ? rows : [];
  let repaired = 0;
  let created_logs = 0;

  for (const row of list) {
    const callId = String(row.smartflo_call_id || '').trim();
    const recordingUrl = String(row.recording_url || '').trim();
    if (!callId || !recordingUrl) continue;

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
    });

    if (attach.callLogId) {
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

export async function syncSmartfloRecordings(input?: {
  hoursBack?: number;
  fromDate?: string;
  toDate?: string;
  maxPages?: number;
  /** Soft deadline — return partial success instead of hanging */
  timeBudgetMs?: number;
  concurrency?: number;
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

  const hoursBack = Math.min(72, Math.max(1, input?.hoursBack ?? 6));
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
  const timeBudgetMs = Math.min(110_000, Math.max(15_000, input?.timeBudgetMs ?? 55_000));
  const concurrency = Math.min(10, Math.max(2, input?.concurrency ?? 6));
  const leadCache = new Map<string, string | null>();

  let page = 1;
  let fetched = 0;
  let upserted = 0;
  let matched = 0;
  let updated_logs = 0;
  let created_logs = 0;
  let with_recording = 0;
  let pages = 0;
  let truncated = false;

  while (page <= maxPages) {
    if (Date.now() - started > timeBudgetMs) {
      truncated = true;
      break;
    }

    const batch = await fetchSmartfloCallRecords({
      token,
      fromDate: from,
      toDate: to,
      page,
      limit: 50,
      timeoutMs: 18000,
    });
    if (!batch.ok) {
      if (page === 1) {
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
        onlyAttachIfRecording: true,
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
      break;
    }
    if (results.length < 50) break;
    page += 1;
  }

  // Heal: re-attach stored CDRs that never linked to a call log (RINGING stubs, late audio)
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (supabaseAdmin) {
      const sinceIso = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      const { data: orphans } = await supabaseAdmin
        .from('smartflo_call_recordings')
        .select('*')
        .is('call_log_id', null)
        .gte('started_at', sinceIso)
        .order('started_at', { ascending: false })
        .limit(80);
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

  // Split wrongly-merged CDRs onto separate call logs
  let repair = { scanned: 0, repaired: 0, created_logs: 0 };
  try {
    repair = await repairDetachedSmartfloRecordings(300);
    created_logs += repair.created_logs;
  } catch (e) {
    console.warn('[smartfloCdr] repair failed:', e);
  }

  let detach = { cleared_logs: 0, cleared_cdr_links: 0 };
  try {
    detach = await detachPreCutoffSmartfloRecordings();
  } catch (e) {
    console.warn('[smartfloCdr] detach pre-cutoff failed:', e);
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
