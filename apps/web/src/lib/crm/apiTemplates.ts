import 'server-only';
import { importedRepeatChecked } from '@/lib/crm/repeatCustomer';
import { CRM_RESULT_LABELS } from '@/lib/crm/apiTemplateShared';

/**
 * CRM API Templates — TeleCRM-style outbound webhooks managed from the admin / manager panel
 * (table crm_api_templates, database/402_crm_api_templates.sql).
 *
 * A template fires when a lead moves into its trigger status, from any save path.
 * Payload is text with {{Variable}} placeholders (TeleCRM names work: {{Phone}}, {{Name}}, {{CARNO}} …).
 */

export type ApiTemplate = {
  id: string;
  name: string;
  method: string;
  url: string;
  timeout_seconds: number;
  auth_type: 'NONE' | 'BEARER' | 'BASIC' | 'HEADER';
  auth_token: string | null;
  auth_username: string | null;
  auth_password: string | null;
  auth_header_name: string | null;
  auth_header_value: string | null;
  extra_headers: Record<string, string> | null;
  payload_type: 'JSON' | 'FORM';
  payload_template: string;
  trigger_status: string;
  is_active: boolean;
  send_once_per_lead?: boolean;
};

export type RunResult = {
  ok: boolean;
  status?: number;
  error?: string;
  response?: string;
  durationMs?: number;
  skipped?: string;
};

const DEDUPE_MS = 5 * 60_000;

export function normalizeCrmResult(value: unknown): string {
  const v = String(value || '').trim().toUpperCase();
  return v === 'COMPLETED' ? 'SERVICE_DONE' : v;
}

function str(v: unknown) {
  return String(v ?? '').trim();
}

function istDateTime(d: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
    .format(d)
    .replace(',', '');
}

/** 21/11/2026 14:45:16 — same as the rows already in the "Today send lead" sheet. */
function istDateTime24(d: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(d)
    .replace(',', '');
}

function appUrl() {
  return (str(process.env.NEXT_PUBLIC_APP_URL) || str(process.env.NEXT_PUBLIC_SITE_URL) || 'https://myfng.in').replace(
    /\/+$/,
    '',
  );
}

/** Variable lookup ignores case, spaces and underscores: {{Service Done}} = {{service_done}}. */
export function varKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export type LeadForTemplate = Record<string, any> & {
  _workshop_name?: string | null;
  _assignee_name?: string | null;
  _assignee_email?: string | null;
};

export async function loadLeadForTemplate(
  db: any,
  where: { id?: string; lead_number?: string },
): Promise<LeadForTemplate | null> {
  let q = db.from('service_leads').select('*');
  q = where.id ? q.eq('id', where.id) : q.eq('lead_number', where.lead_number);
  const { data: lead } = await q.maybeSingle();
  if (!lead) return null;
  const [ws, tc] = await Promise.all([
    lead.workshop_id
      ? db.from('workshops').select('name').eq('id', lead.workshop_id).maybeSingle()
      : Promise.resolve({ data: null }),
    lead.assigned_telecaller_id
      ? db.from('users_login').select('full_name, email').eq('id', lead.assigned_telecaller_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    ...lead,
    _workshop_name: ws?.data?.name || null,
    _assignee_name: tc?.data?.full_name || null,
    _assignee_email: tc?.data?.email || null,
  };
}

/** All {{variables}} for one lead. Keys are varKey()'d. */
export function buildLeadVariables(
  lead: LeadForTemplate,
  ctx: { trigger?: string | null; actorName?: string | null; now?: Date } = {},
): Record<string, string> {
  const meta = lead.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
  const now = ctx.now || new Date();
  const digits = String(lead.customer_phone || '').replace(/\D/g, '');
  const phone10 = digits.length > 10 ? digits.slice(-10) : digits;
  const carNo = str(lead.vehicle_number);
  const model = [lead.vehicle_make, lead.vehicle_model]
    .map(str)
    .filter((v) => v && v.toUpperCase() !== 'NA')
    .join(' ');
  const address =
    str(lead.customer_address) ||
    str(lead.pickup_address) ||
    [meta.flat_number, meta.area, meta.landmark, lead.city, lead.pincode].map(str).filter(Boolean).join(', ');
  const result = normalizeCrmResult(ctx.trigger || meta.last_call_result || '');
  const statusLabel = CRM_RESULT_LABELS[result] || str(meta.last_call_label) || result;
  const leadLink = `${appUrl()}/dashboard/super_admin/bookings?lead=${encodeURIComponent(
    str(lead.lead_number) || str(lead.id),
  )}`;
  const actor = str(ctx.actorName);

  const vars: Record<string, string> = {
    phone: phone10,
    phonewithcode: phone10 ? `91${phone10}` : '',
    name: str(lead.customer_name),
    email: str(lead.customer_email),
    workshop: str(lead._workshop_name),
    package: str(lead.service_type) || str(meta.vehicle_class),
    amount: lead.estimated_amount == null ? '' : String(lead.estimated_amount),
    pickupvisit: lead.pickup_required ? 'Pickup' : 'Visit',
    remark: str(meta.telecaller_remarks) || str(lead.notes),
    note: str(lead.notes),
    model,
    make: str(lead.vehicle_make),
    carmodel: str(lead.vehicle_model),
    carno: carNo.toUpperCase() === 'NA' ? '' : carNo.toUpperCase(),
    vehicleclass: str(meta.vehicle_class),
    fuel: str(lead.vehicle_fuel_type),
    address,
    area: str(meta.area) || str(lead.city),
    city: str(lead.city),
    pincode: str(lead.pincode),
    plan: str(meta.plan || meta.membership_plan || meta.plan_name),
    status: statusLabel,
    statuscode: result,
    leadnumber: str(lead.lead_number),
    leadlink: leadLink,
    // TeleCRM-compatible: the panel's "lead_link" field was filled from {{lead_id}}.
    leadid: leadLink,
    leaduuid: str(lead.id),
    source: str(lead.lead_source),
    servicedone: istDateTime(now),
    datetime: istDateTime(now),
    sentat: istDateTime24(now),
    service: str(lead.service_type),
    preferredslot: lead.preferred_slot_start ? istDateTime(new Date(lead.preferred_slot_start)) : '',
    actiontext: `${statusLabel}${actor ? ` by ${actor}` : ''} · MyFNG ${str(lead.lead_number)}`.trim(),
    changedby: actor,
    assigneeemail: str(lead._assignee_email),
    assigneename: str(lead._assignee_name),
    repeatcustomer: importedRepeatChecked(lead) ? 'Yes' : 'No',
  };
  return vars;
}

const VAR_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Names used in a template, as written. */
export function templateVariables(text: string): string[] {
  const out = new Set<string>();
  for (const m of String(text || '').matchAll(VAR_RE)) out.add(m[1].trim());
  return Array.from(out);
}

export function unknownVariables(text: string): string[] {
  const known = new Set(Object.keys(buildLeadVariables({} as LeadForTemplate)));
  return templateVariables(text).filter((v) => !known.has(varKey(v)));
}

function fill(text: string, vars: Record<string, string>, escape: (v: string) => string) {
  return String(text || '').replace(VAR_RE, (_m, name: string) => escape(vars[varKey(name)] ?? ''));
}

export type RenderedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  /** Parsed payload for display (JSON object or form fields). */
  preview: unknown;
};

/** Build the HTTP request for one lead. Throws on an invalid JSON payload. */
export function renderTemplate(tpl: ApiTemplate, vars: Record<string, string>): RenderedRequest {
  const method = String(tpl.method || 'POST').toUpperCase();
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(tpl.extra_headers || {})) {
    if (k.trim()) headers[k.trim()] = fill(String(v ?? ''), vars, (x) => x);
  }
  if (tpl.auth_type === 'BEARER' && tpl.auth_token) headers.Authorization = `Bearer ${tpl.auth_token}`;
  if (tpl.auth_type === 'BASIC' && (tpl.auth_username || tpl.auth_password)) {
    headers.Authorization = `Basic ${Buffer.from(`${tpl.auth_username || ''}:${tpl.auth_password || ''}`).toString('base64')}`;
  }
  if (tpl.auth_type === 'HEADER' && tpl.auth_header_name) {
    headers[tpl.auth_header_name] = String(tpl.auth_header_value || '');
  }

  let url = fill(tpl.url, vars, (x) => encodeURIComponent(x));
  // JSON: values sit inside quotes, so escape them as JSON string content.
  const jsonText = fill(tpl.payload_template || '', vars, (x) => JSON.stringify(x).slice(1, -1));
  let parsed: any = null;
  if (jsonText.trim()) {
    try {
      parsed = JSON.parse(jsonText);
    } catch (e: any) {
      throw new Error(`Payload is not valid JSON: ${e?.message || 'parse error'}`);
    }
  }

  if (method === 'GET' || method === 'DELETE') {
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const u = new URL(url);
      for (const [k, v] of Object.entries(parsed)) u.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
      url = u.toString();
    }
    return { url, method, headers, body: null, preview: parsed };
  }

  if (tpl.payload_type === 'FORM') {
    const form = new URLSearchParams();
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) form.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded';
    return { url, method, headers, body: form.toString(), preview: parsed };
  }

  headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  return { url, method, headers, body: parsed == null ? '' : JSON.stringify(parsed), preview: parsed };
}

export function maskSecret(value: string | null | undefined): string {
  const v = String(value || '');
  if (!v) return '';
  if (v.length <= 8) return '••••';
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
}

export function maskHeaders(headers: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = /authorization|token|key|secret/i.test(k) ? maskSecret(v) : v;
  }
  return out;
}

/**
 * Some endpoints answer HTTP 200 with an error body (Google Apps Script: {"ok":false,"error":…},
 * PHP panels: {"status":"error"}). Treat those as failures.
 */
function responseBodyError(text: string): string | null {
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!json || typeof json !== 'object') return null;
  const failed =
    json.ok === false || json.success === false || String(json.status || '').toLowerCase() === 'error';
  if (!failed) return null;
  return String(json.error || json.message || 'Endpoint returned an error').slice(0, 300);
}

/** Send one rendered template and log it. */
export async function executeTemplate(
  db: any,
  tpl: ApiTemplate,
  lead: LeadForTemplate,
  ctx: { trigger: string; actorName?: string | null; actorId?: string | null },
): Promise<RunResult & { request?: RenderedRequest }> {
  const started = Date.now();
  let req: RenderedRequest | undefined;
  let result: RunResult;
  try {
    req = renderTemplate(tpl, buildLeadVariables(lead, { trigger: ctx.trigger === 'TEST' ? null : ctx.trigger, actorName: ctx.actorName }));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.max(1, Number(tpl.timeout_seconds) || 10) * 1000);
    try {
      const res = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body == null ? undefined : req.body,
        signal: ctrl.signal,
      });
      const text = await res.text().catch(() => '');
      const bodyError = responseBodyError(text);
      result =
        res.ok && !bodyError
          ? { ok: true, status: res.status, response: text.slice(0, 2000) }
          : {
              ok: false,
              status: res.status,
              response: text.slice(0, 2000),
              error: res.ok ? bodyError || 'Rejected' : `HTTP ${res.status}`,
            };
    } finally {
      clearTimeout(timer);
    }
  } catch (e: any) {
    result = { ok: false, error: e?.name === 'AbortError' ? 'Timed out' : e?.message || 'Request failed' };
  }
  result.durationMs = Date.now() - started;

  const nowIso = new Date().toISOString();
  try {
    await Promise.all([
      db.from('crm_api_template_runs').insert({
        template_id: tpl.id,
        lead_id: lead.id || null,
        lead_number: lead.lead_number || null,
        trigger: ctx.trigger,
        ok: result.ok,
        status_code: result.status ?? null,
        error: result.ok ? null : result.error || null,
        request_body: req?.body ? req.body.slice(0, 4000) : req ? JSON.stringify(req.preview ?? null).slice(0, 4000) : null,
        response_body: result.response || null,
        duration_ms: result.durationMs,
        run_by_id: ctx.actorId || null,
        run_by_name: ctx.actorName || null,
      }),
      db
        .from('crm_api_templates')
        .update({
          last_run_at: nowIso,
          last_run_ok: result.ok,
          last_run_status: result.status ?? null,
          last_run_error: result.ok ? null : `${result.error || 'failed'}${result.response ? ` · ${result.response.slice(0, 200)}` : ''}`,
        })
        .eq('id', tpl.id),
    ]);
  } catch (logErr) {
    console.warn('[api-templates] log failed', logErr);
  }
  if (!result.ok) console.warn('[api-templates] send failed', tpl.name, lead.lead_number, result.error);
  return { ...result, request: req };
}

async function stampWonSheet(db: any, leadId: string) {
  try {
    const { data } = await db.from('service_leads').select('coupon_meta').eq('id', leadId).maybeSingle();
    const meta = data?.coupon_meta && typeof data.coupon_meta === 'object' ? { ...data.coupon_meta } : {};
    if (meta.won_sheet_at) return;
    meta.won_sheet_at = new Date().toISOString();
    await db.from('service_leads').update({ coupon_meta: meta }).eq('id', leadId);
  } catch {
    /* best-effort */
  }
}

/**
 * True when a template (ON or OFF, not deleted) is set up for this status — and for `url`
 * when given. The old hardcoded sender for the same job then stands down, so:
 *   template ON  → only the template sends
 *   template OFF → nothing is sent
 *   template deleted → the old built-in sender takes over again
 */
export async function hasApiTemplate(db: any, trigger: string, url?: string | null): Promise<boolean> {
  try {
    const { data, error } = await db
      .from('crm_api_templates')
      .select('id, url')
      .eq('trigger_status', normalizeCrmResult(trigger))
      .is('deleted_at', null)
      .limit(50);
    if (error || !data?.length) return false;
    if (!url) return true;
    const want = String(url).trim();
    return (data as any[]).some((r) => String(r.url || '').trim() === want);
  } catch {
    return false;
  }
}

function isMissingTable(error: any) {
  const msg = String(error?.message || '');
  return error?.code === '42P01' || error?.code === 'PGRST205' || /crm_api_templates/.test(msg) && /exist|find/i.test(msg);
}

/**
 * Lead moved prev → next: send every active template whose trigger is `next`.
 * Returns how many active templates match `next` (null when the table is not there yet).
 */
export async function runApiTemplatesForStatusChange(
  db: any,
  leadId: string,
  prevResult: unknown,
  nextResult: unknown,
  actor: { name?: string | null; id?: string | null } = {},
): Promise<number | null> {
  const prev = normalizeCrmResult(prevResult);
  const next = normalizeCrmResult(nextResult);
  if (!next || next === prev) return 0;

  const { data: templates, error } = await db
    .from('crm_api_templates')
    .select('*')
    .eq('trigger_status', next)
    .eq('is_active', true)
    .is('deleted_at', null);
  if (error) {
    if (isMissingTable(error)) return null;
    console.warn('[api-templates] load failed', error.message);
    return 0;
  }
  if (!templates?.length) return 0;

  const lead = await loadLeadForTemplate(db, { id: leadId });
  if (!lead) return templates.length;

  const since = new Date(Date.now() - DEDUPE_MS).toISOString();
  const leadMeta = lead.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
  let fired = 0;
  for (const tpl of templates as ApiTemplate[]) {
    if (tpl.send_once_per_lead) {
      // Booking confirmed leads the old sheet code already sent carry won_sheet_at.
      if (next === 'BOOKING_CONFIRMED' && leadMeta.won_sheet_at) continue;
      const { data: ever } = await db
        .from('crm_api_template_runs')
        .select('id')
        .eq('template_id', tpl.id)
        .eq('lead_id', leadId)
        .neq('trigger', 'TEST')
        .eq('ok', true)
        .limit(1);
      if (ever?.length) continue;
    } else {
      // Two save paths can fire for one click — send once per template + lead + status.
      const { data: recent } = await db
        .from('crm_api_template_runs')
        .select('id')
        .eq('template_id', tpl.id)
        .eq('lead_id', leadId)
        .eq('trigger', next)
        .eq('ok', true)
        .gte('created_at', since)
        .limit(1);
      if (recent?.length) continue;
    }
    const res = await executeTemplate(db, tpl, lead, { trigger: next, actorName: actor.name, actorId: actor.id });
    fired += 1;
    // Keep the Booking Confirmed list's "on sheet" flag working for once-per-lead sheet templates.
    if (res.ok && tpl.send_once_per_lead && next === 'BOOKING_CONFIRMED') {
      await stampWonSheet(db, leadId);
    }
  }
  if (fired) console.log('[api-templates] fired', fired, 'for', lead.lead_number, next);
  return templates.length;
}
