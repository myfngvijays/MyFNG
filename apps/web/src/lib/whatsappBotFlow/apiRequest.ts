import {
  DEFAULT_API_HEADERS,
  DEFAULT_TELECRM_FLOW_BODY,
  TELECRM_API_BEARER,
  TELECRM_API_URL,
} from './telecrmApiBody';

type ApiParam = { key?: string; value?: string };

function fill(text: string, variables: Record<string, unknown>) {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = variables[key] ?? variables[String(key).toLowerCase()];
    return value == null ? '' : String(value);
  });
}

function paramsOf(value: unknown): ApiParam[] {
  return Array.isArray(value) ? (value as ApiParam[]) : [];
}

export function flowApiVariables(phone: string, variables: Record<string, unknown>, profileName?: string | null) {
  const local10 = String(phone || '').replace(/\D/g, '').slice(-10);
  const name = String(variables.name || profileName || '');
  const button = String(variables.button || '');
  const dial = local10 ? `+91${local10}` : String(variables.phone || '');
  return {
    ...variables,
    name,
    chat_name: name,
    phone: dial,
    waba: dial,
    button,
    cust_keyword: button || String(variables.last_message || ''),
  };
}

export async function executeFlowApiRequest(data: Record<string, unknown>, variables: Record<string, unknown>) {
  const method = String(data.apiMethod || 'POST').trim().toUpperCase() || 'POST';
  let url = fill(String(data.apiUrl || TELECRM_API_URL).trim(), variables);
  const query = paramsOf(data.apiQuery).filter((item) => String(item.key || '').trim());
  if (query.length) {
    const parsed = new URL(url);
    for (const item of query) parsed.searchParams.set(fill(String(item.key), variables), fill(String(item.value || ''), variables));
    url = parsed.toString();
  }

  const headers: Record<string, string> = {};
  const listed = paramsOf(data.apiHeaders);
  const headerRows = listed.length ? listed : DEFAULT_API_HEADERS;
  for (const item of headerRows) {
    const key = String(item.key || '').trim();
    if (!key) continue;
    headers[key] = fill(String(item.value || ''), variables);
  }
  const auth = String(data.apiAuthType || 'bearer').toLowerCase();
  const bearer = String(data.apiBearer || TELECRM_API_BEARER).trim();
  if (auth === 'bearer' && bearer && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${bearer}`;
  }
  if (!headers['Content-Type'] && !headers['content-type'] && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  const rawBody = fill(String(data.apiBody || DEFAULT_TELECRM_FLOW_BODY).trim(), variables);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method === 'GET' ? undefined : rawBody,
      signal: controller.signal,
    });
    const text = await response.text().catch(() => '');
    if (!response.ok) throw new Error(`API ${response.status} ${text.slice(0, 180)}`.trim());
    return { ok: true, status: response.status, body: text.slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}
