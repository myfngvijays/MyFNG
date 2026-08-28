import {
  getApprovedTemplateByEvent,
  getDltEntity,
  getPrimaryTelemarketerRaw,
  getTemplateById,
  insertLog,
} from './store';
import { DEFAULT_OPERATOR_BODY, type DltSmsTemplate } from './types';

function cleanPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

function isValidInPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(cleanPhone(phone));
}

export function renderTemplate(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    const v = String(value ?? '');
    out = out.replaceAll(`{#${key}#}`, v);
    out = out.replaceAll(`{{${key}}}`, v);
    out = out.replaceAll(`{${key}}`, v);
  }
  return out;
}

function timeoutSignal(ms = 20000): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

function fillOperatorTemplate(
  template: string,
  ctx: Record<string, string>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(ctx)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

async function sendOwnOperatorHttp(opts: {
  apiUrl: string;
  apiKey: string;
  extra: Record<string, unknown>;
  peId: string;
  header: string;
  dltTemplateId: string;
  phone: string;
  message: string;
  vars: Record<string, string>;
}): Promise<{ ok: boolean; id: string; error: string }> {
  const urlTpl = opts.apiUrl.trim();
  if (!urlTpl) {
    return {
      ok: false,
      id: '',
      error: 'Own SMS pipe has no operator URL. Add the HTTP endpoint Jio/Airtel gave you as telemarketer.',
    };
  }

  const phone = cleanPhone(opts.phone);
  const ctx: Record<string, string> = {
    pe_id: opts.peId,
    header: opts.header,
    dlt_template_id: opts.dltTemplateId,
    phone,
    mobile: `91${phone}`,
    message: opts.message,
    vars_json: JSON.stringify(opts.vars || {}),
    api_key: opts.apiKey,
  };

  const method = String(opts.extra.http_method || 'POST').toUpperCase();
  const url = fillOperatorTemplate(urlTpl, ctx);
  const bodyTpl = String(opts.extra.body_template || DEFAULT_OPERATOR_BODY);
  const body = fillOperatorTemplate(bodyTpl, ctx);
  const contentType = String(opts.extra.content_type || 'application/json');
  const authType = String(opts.extra.auth_type || 'bearer').toLowerCase();
  const customHeader = String(opts.extra.auth_header || 'Authorization');

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') headers['Content-Type'] = contentType;
  if (opts.apiKey) {
    if (authType === 'header') headers[customHeader] = opts.apiKey;
    else if (authType === 'basic') {
      headers.Authorization = `Basic ${Buffer.from(opts.apiKey).toString('base64')}`;
    } else if (authType !== 'query' && authType !== 'none') {
      headers.Authorization = opts.apiKey.startsWith('Bearer ') ? opts.apiKey : `Bearer ${opts.apiKey}`;
    }
  }

  const res = await fetch(url, {
    method: method === 'GET' ? 'GET' : method,
    headers,
    body: method === 'GET' ? undefined : body,
    signal: timeoutSignal(),
  });
  const text = await res.text().catch(() => '');
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  const successNeedle = String(opts.extra.success_contains || '').trim().toLowerCase();
  const looksOk =
    res.ok &&
    (successNeedle
      ? text.toLowerCase().includes(successNeedle)
      : json?.status !== 'error' && json?.ok !== false && json?.type !== 'error');

  if (!looksOk) {
    return { ok: false, id: '', error: text.slice(0, 400) || `Operator HTTP ${res.status}` };
  }

  const id = String(
    json?.id || json?.messageId || json?.message_id || json?.txn_id || json?.request_id || json?.job_id || '',
  );
  return { ok: true, id: id || text.slice(0, 80), error: '' };
}

export async function sendDltSms(opts: {
  phone: string;
  templateId?: string;
  eventKey?: string;
  vars?: Record<string, string>;
  messageOverride?: string;
  createdBy?: string | null;
}): Promise<{ ok: boolean; attempted: boolean; error?: string; provider?: string }> {
  if (!isValidInPhone(opts.phone)) {
    return { ok: false, attempted: true, error: 'Invalid Indian mobile number' };
  }

  const tm = await getPrimaryTelemarketerRaw();
  if (!tm) {
    return { ok: false, attempted: false, error: 'No own SMS pipe configured' };
  }

  let template: DltSmsTemplate | null = null;
  if (opts.templateId) template = await getTemplateById(opts.templateId);
  else if (opts.eventKey) template = await getApprovedTemplateByEvent(opts.eventKey);

  if (!template) {
    return { ok: false, attempted: false, error: 'No matching DLT content template' };
  }
  if (template.status !== 'APPROVED') {
    return { ok: false, attempted: true, error: 'Template is not approved' };
  }

  const entity = await getDltEntity();
  const vars = opts.vars || {};
  const message = opts.messageOverride || renderTemplate(template.template_text, vars);
  const header = String(tm.default_header || '').trim().toUpperCase();
  const dltId = String(template.dlt_template_id || '').trim();
  const extra = tm.extra_config && typeof tm.extra_config === 'object' ? tm.extra_config : {};

  if (!dltId) {
    return { ok: false, attempted: true, error: 'Paste TRAI DLT Template ID on the content template before sending' };
  }
  if (entity.entity_status !== 'APPROVED') {
    return { ok: false, attempted: true, error: 'Principal Entity is not approved' };
  }
  if (String(tm.provider || '').toUpperCase() === 'SMPP') {
    return {
      ok: false,
      attempted: true,
      error:
        'SMPP bind is stored but not started from this app process. Use operator HTTP (Jio CPaaS URL) for MyFNG own pipe, or run a dedicated SMPP worker.',
    };
  }

  let result = { ok: false, id: '', error: 'Send failed' };
  try {
    result = await sendOwnOperatorHttp({
      apiUrl: String(tm.api_url || ''),
      apiKey: String(tm.api_key || ''),
      extra,
      peId: entity.pe_id,
      header,
      dltTemplateId: dltId,
      phone: opts.phone,
      message,
      vars,
    });
  } catch (e: any) {
    result = { ok: false, id: '', error: e?.message || 'Send failed' };
  }

  await insertLog({
    phone: `+91${cleanPhone(opts.phone)}`,
    template_id: template.id,
    header,
    message,
    provider: tm.provider || 'MYFNG',
    status: result.ok ? 'SENT' : 'FAILED',
    provider_message_id: result.id,
    error: result.error,
    created_by: opts.createdBy,
  });

  return {
    ok: result.ok,
    attempted: true,
    error: result.ok ? undefined : result.error,
    provider: tm.provider || 'MYFNG',
  };
}

export async function sendDltEventSms(opts: {
  phone: string;
  eventKey: string;
  vars?: Record<string, string>;
  message?: string;
}): Promise<{ ok: boolean; attempted: boolean; error?: string }> {
  return sendDltSms({
    phone: opts.phone,
    eventKey: opts.eventKey,
    vars: opts.vars,
    messageOverride: opts.message,
  });
}
