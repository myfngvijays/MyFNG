import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { assertSuperAdminAccess } from '@/lib/admin_ai/auth';
import {
  appendAdminChatMessage,
  getAdminChatMessages,
  type StoredAdminMessage,
} from '@/lib/admin_ai/chatStore';
import {
  describeColumn,
  describeTableSchema,
  listKnownTables,
} from '@/lib/admin_ai/schemaCatalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    function?: { name: string; arguments: string };
  }>;
};

const DEFAULT_MODEL = 'gpt-4o-mini';

const OWNER_SYSTEM_PROMPT = `
You are MY FNG Super Admin AI for company owner-level operations.
Rules:
- Use tools for all factual statements (counts, revenue, status, records, trends).
- Never guess data. If unavailable, say what is missing.
- Keep responses clean, concise, actionable, and business-first.
- Mention filters/date-range used in analysis.
- When user asks column meaning, use schema tools and explain simply.
- If user asks any business KPI, always run one or more tools first before answering.
- Prefer realtime range snapshots over assumptions.
`;

const ALLOWED_TABLES = new Set([
  ...listKnownTables(),
  'workshop_payouts',
  'refund_requests',
  'fraud_cases',
  'telecaller_follow_ups',
  'lead_activities',
  'sarv_call_rsa_links',
  'pincode_city_state',
]);

const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'list_tables',
      description: 'List all allowed tables for admin AI queries',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'describe_table',
      description: 'Explain table purpose and known columns',
      parameters: {
        type: 'object',
        required: ['table'],
        properties: { table: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'describe_column',
      description: 'Explain a specific column meaning',
      parameters: {
        type: 'object',
        required: ['table', 'column'],
        properties: {
          table: { type: 'string' },
          column: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'count_rows',
      description: 'Count rows in table with optional created_at date window',
      parameters: {
        type: 'object',
        required: ['table'],
        properties: {
          table: { type: 'string' },
          from: { type: 'string' },
          to: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'filtered_rows',
      description: 'Read rows with safe filters from allowed table',
      parameters: {
        type: 'object',
        required: ['table'],
        properties: {
          table: { type: 'string' },
          columns: { type: 'array', items: { type: 'string' } },
          filters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                column: { type: 'string' },
                op: { type: 'string', enum: ['eq', 'ilike', 'gte', 'lte', 'in', 'is'] },
                value: {
                  oneOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'boolean' },
                    { type: 'null' },
                    {
                      type: 'array',
                      items: {
                        oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' }],
                      },
                    },
                  ],
                },
              },
            },
          },
          limit: { type: 'number' },
          order_by: { type: 'string' },
          order_dir: { type: 'string', enum: ['asc', 'desc'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'aggregate',
      description: 'Aggregate column values (sum, avg, min, max) with optional filters',
      parameters: {
        type: 'object',
        required: ['table', 'column', 'metric'],
        properties: {
          table: { type: 'string' },
          column: { type: 'string' },
          metric: { type: 'string', enum: ['sum', 'avg', 'min', 'max'] },
          filters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                column: { type: 'string' },
                op: { type: 'string', enum: ['eq', 'ilike', 'gte', 'lte', 'in', 'is'] },
                value: {
                  oneOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'boolean' },
                    { type: 'null' },
                    {
                      type: 'array',
                      items: {
                        oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' }],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recent_activity',
      description: 'Fetch recent operational events from key tables',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finance_snapshot',
      description: 'Finance snapshot for date range including paid invoices and pending refunds',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rsa_overview_range',
      description: 'RSA lead snapshot including status mix and completion stats for date range',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'workshop_health',
      description: 'Workshop performance snapshot by city and verification status',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'employee_performance_summary',
      description: 'Employee call handling summary from SARV calls',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'call_disposition_city_breakdown',
      description: 'SARV call breakdown by disposition and city for date range',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'business_overview_realtime',
      description: 'Realtime business overview KPIs across calls, leads, revenue, refunds, payouts',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lead_funnel_snapshot',
      description: 'Lead funnel counts by status and conversion for a date range',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          lead_type: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'city_business_snapshot',
      description: 'City-wise business metrics (calls, leads, revenue) for one city or top cities',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          from: { type: 'string' },
          to: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'workshop_performance_snapshot',
      description: 'Workshop-wise lead performance and completion metrics',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          from: { type: 'string' },
          to: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'risk_alerts_snapshot',
      description: 'Operational risk alerts: pending refunds/payouts, unresolved complaints, overdue leads',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
        },
      },
    },
  },
];

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function makeConversationId() {
  return crypto.randomUUID();
}

function toNum(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function isSafeIdentifier(name: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function normalizeDateRange(args: any) {
  const now = new Date();
  const from = String(args?.from || new Date(now.getTime() - 30 * 86400000).toISOString());
  const to = String(args?.to || now.toISOString());
  return { from, to };
}

function looksLikeCurrentMonthQuery(text: string) {
  const q = String(text || '').toLowerCase();
  return (
    q.includes('this month') ||
    q.includes('current month') ||
    q.includes('is month') ||
    q.includes('es month') ||
    q.includes('iss month')
  );
}

function currentMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = now.toISOString();
  return { from, to };
}

async function fetchAllSarvCallsForRange(db: any, from: string, to: string) {
  const pageSize = 1000;
  const allRows: any[] = [];
  let offset = 0;
  let totalExpected: number | null = null;
  let loopGuard = 0;

  while (loopGuard < 300) {
    loopGuard += 1;
    const { data, error, count } = await db
      .from('sarv_calls')
      .select('id,cnumber,disposition,disposition_category', {
        count: offset === 0 ? 'exact' : undefined,
      })
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return { rows: allRows, error: error.message || 'Failed to fetch sarv_calls' };
    }

    if (offset === 0 && typeof count === 'number') {
      totalExpected = count;
    }

    const batch = Array.isArray(data) ? data : [];
    allRows.push(...batch);

    if (batch.length < pageSize) break;
    offset += pageSize;
    if (totalExpected != null && allRows.length >= totalExpected) break;
  }

  return { rows: allRows, error: null as string | null };
}

async function fetchAllRowsByDateRange(params: {
  db: any;
  table: string;
  select: string;
  dateColumn: string;
  from: string;
  to: string;
  pageSize?: number;
  maxPages?: number;
}) {
  const pageSize = Math.max(100, Math.min(2000, Number(params.pageSize || 1000)));
  const maxPages = Math.max(1, Math.min(500, Number(params.maxPages || 200)));
  const rows: any[] = [];
  let offset = 0;
  let pages = 0;

  while (pages < maxPages) {
    pages += 1;
    const { data, error } = await params.db
      .from(params.table)
      .select(params.select)
      .gte(params.dateColumn, params.from)
      .lte(params.dateColumn, params.to)
      .order(params.dateColumn, { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return { rows, error: error.message || `Failed to fetch ${params.table}` };
    }

    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return { rows, error: null as string | null };
}

function normalizePincode(value?: string | null) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function deriveCityFromAddress(address?: string | null) {
  const parts = String(address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  return '';
}

function digits10(value?: string | null) {
  const d = String(value || '').replace(/\D/g, '');
  if (!d) return '';
  return d.length <= 10 ? d : d.slice(-10);
}

function chunkArray<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function buildCityByCallId(db: any, callIds: string[]) {
  const cityByCallId = new Map<string, string>();
  if (!callIds.length) return cityByCallId;

  const linkRows: any[] = [];
  for (const idChunk of chunkArray(callIds, 500)) {
    const { data } = await db
      .from('sarv_call_rsa_links')
      .select('sarv_call_id, rsa_lead_id')
      .in('sarv_call_id', idChunk);
    if (Array.isArray(data)) linkRows.push(...data);
  }

  const leadIds = Array.from(
    new Set(linkRows.map((row: any) => String(row?.rsa_lead_id || '').trim()).filter(Boolean))
  );
  const leadById = new Map<string, any>();
  for (const leadChunk of chunkArray(leadIds, 500)) {
    const { data } = await db.from('rsa_leads').select('id, pincode, address').in('id', leadChunk);
    for (const lead of data || []) {
      const key = String((lead as any)?.id || '').trim();
      if (key) leadById.set(key, lead);
    }
  }

  const pincodes = Array.from(
    new Set(
      Array.from(leadById.values())
        .map((lead: any) => normalizePincode(lead?.pincode))
        .filter(Boolean)
    )
  );
  const districtByPincode = new Map<string, string>();
  for (const pinChunk of chunkArray(pincodes, 500)) {
    const { data } = await db.from('pincode_city_state').select('pincode, district').in('pincode', pinChunk);
    for (const row of data || []) {
      const pin = normalizePincode((row as any)?.pincode);
      const district = String((row as any)?.district || '').trim();
      if (pin && district) districtByPincode.set(pin, district);
    }
  }

  for (const link of linkRows) {
    const callId = String((link as any)?.sarv_call_id || '').trim();
    if (!callId || cityByCallId.has(callId)) continue;
    const lead = leadById.get(String((link as any)?.rsa_lead_id || '').trim());
    if (!lead) continue;
    const pin = normalizePincode((lead as any)?.pincode);
    const city = (pin ? districtByPincode.get(pin) : '') || deriveCityFromAddress((lead as any)?.address) || '';
    if (city) cityByCallId.set(callId, city);
  }

  return cityByCallId;
}

async function buildCityByPhone(db: any, from: string, to: string) {
  const dateFilter = `or(and(lead_registered_at.gte.${from},lead_registered_at.lte.${to}),and(requested_at.gte.${from},requested_at.lte.${to}))`;
  const { data: leadRows } = await db
    .from('rsa_leads')
    .select('contact_number, alternate_number, pincode, address')
    .eq('delete_status', false)
    .or(dateFilter);

  const pins = Array.from(
    new Set(
      (leadRows || [])
        .map((lead: any) => normalizePincode(lead?.pincode))
        .filter(Boolean)
    )
  );
  const districtByPincode = new Map<string, string>();
  for (const pinChunk of chunkArray(pins, 500)) {
    const { data } = await db.from('pincode_city_state').select('pincode, district').in('pincode', pinChunk);
    for (const row of data || []) {
      const pin = normalizePincode((row as any)?.pincode);
      const district = String((row as any)?.district || '').trim();
      if (pin && district) districtByPincode.set(pin, district);
    }
  }

  const cityByPhone = new Map<string, string>();
  for (const lead of leadRows || []) {
    const pin = normalizePincode((lead as any)?.pincode);
    const city = (pin ? districtByPincode.get(pin) : '') || deriveCityFromAddress((lead as any)?.address) || '';
    if (!city) continue;
    const p1 = digits10((lead as any)?.contact_number);
    const p2 = digits10((lead as any)?.alternate_number);
    if (p1 && !cityByPhone.has(p1)) cityByPhone.set(p1, city);
    if (p2 && !cityByPhone.has(p2)) cityByPhone.set(p2, city);
  }
  return cityByPhone;
}

function isCurrentMonthCallIntent(text: string) {
  const q = String(text || '').toLowerCase();
  const monthHit = /(?:this|current|is|es|iss)\s+month|month/.test(q);
  const callHit = /call|calls|calls?\s+aye|total\s+call/.test(q);
  return monthHit && callHit;
}

function hasExplicitDateReference(text: string) {
  const q = String(text || '').toLowerCase();
  return (
    /\b(20\d{2})\b/.test(q) ||
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/.test(q) ||
    /\b(today|yesterday|tomorrow|week|last month|previous month|quarter|year)\b/.test(q) ||
    /\b(आज|कल|पिछले|महीने|साल)\b/.test(q)
  );
}

function isFollowUpCallBreakdownIntent(text: string) {
  const q = String(text || '').toLowerCase();
  const followUpWords = /baki|aur|also|breakdown|detail|details|city|disposition|reason|report|split/.test(q);
  const callWords = /call|calls|disposition|city/.test(q);
  return followUpWords && callWords;
}

function isFollowUpBusinessIntent(text: string) {
  const q = String(text || '').toLowerCase();
  return /(baki|aur|also|detail|details|report|city|disposition|reason|profit|revenue|finance|payout|refund)/.test(q);
}

function isCallAnalyticsIntent(text: string) {
  const q = String(text || '').toLowerCase();
  const callWords = /(call|calls|disposition|reason|city|shahar)/.test(q);
  const analyticsWords = /(report|breakdown|split|wise|total|baki|all|sabhi|pura|complete|kitne|kitna)/.test(q);
  return callWords && analyticsWords;
}

function isFinanceIntent(text: string) {
  const q = String(text || '').toLowerCase();
  return /(profit|revenue|finance|payout|refund|invoice|payment)/.test(q);
}

function isConversationSummaryIntent(text: string) {
  const q = String(text || '').toLowerCase();
  return /(summary|summarize|summarise|summerize|chat summary|pura chat|poora chat|chat ka summary)/.test(q);
}

function buildSummaryTranscript(messages: StoredAdminMessage[]) {
  return messages
    .slice(-80)
    .map((m) => {
      const role = m.role === 'assistant' ? 'Assistant' : m.role === 'user' ? 'User' : 'System';
      const text = String(m.text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 700);
      return `${role}: ${text}`;
    })
    .join('\n');
}

function hasRecentCurrentMonthContext(previous: StoredAdminMessage[]) {
  const recent = previous.slice(-8);
  return recent.some((m) => {
    if (m.role !== 'assistant') return false;
    const t = String(m.text || '').toLowerCase();
    return t.includes('current month total calls:') || t.includes('range used:');
  });
}

function validateTable(table: string): { ok: true; table: string } | { ok: false; error: string } {
  const t = String(table || '').trim();
  if (!t || !ALLOWED_TABLES.has(t)) {
    return { ok: false, error: `Table "${t}" not allowed` };
  }
  return { ok: true, table: t };
}

function applyFilters(query: any, filters: any[] = []) {
  let q = query;
  for (const f of filters) {
    const column = String(f?.column || '').trim();
    const op = String(f?.op || '').trim();
    const value = f?.value;
    if (!column || !isSafeIdentifier(column)) continue;
    if (op === 'eq') q = q.eq(column, value);
    else if (op === 'ilike') q = q.ilike(column, `%${String(value || '').trim()}%`);
    else if (op === 'gte') q = q.gte(column, value);
    else if (op === 'lte') q = q.lte(column, value);
    else if (op === 'in' && Array.isArray(value)) q = q.in(column, value);
    else if (op === 'is') q = q.is(column, value);
  }
  return q;
}

function resolveModel(input: any) {
  const requested = String(input || '').trim();
  if (
    requested &&
    /^(gpt-|o[0-9a-z-]+)/i.test(requested) &&
    !/(audio|transcribe|tts|realtime|embedding|moderation|image)/i.test(requested)
  ) {
    return requested;
  }
  return DEFAULT_MODEL;
}

async function createCompletion(messages: ChatMessage[], model: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      tools: TOOL_DEFS,
      tool_choice: 'auto',
      temperature: 0.1,
      max_tokens: 1400,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI failed (${res.status}): ${txt.slice(0, 280)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message as ChatMessage | undefined;
}

async function createPlainCompletion(messages: ChatMessage[], model: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 900,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI failed (${res.status}): ${txt.slice(0, 280)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message as ChatMessage | undefined;
}

async function runTool(
  db: any,
  name: string,
  args: any,
  context?: { userMessage?: string; forceCurrentMonth?: boolean }
) {
  if (name === 'list_tables') {
    return { tables: Array.from(ALLOWED_TABLES).sort((a, b) => a.localeCompare(b)) };
  }
  if (name === 'describe_table') {
    const check = validateTable(args?.table);
    if (!check.ok) return { error: check.error };
    const meta = describeTableSchema(check.table);
    return { table: check.table, meta: meta || null };
  }
  if (name === 'describe_column') {
    const check = validateTable(args?.table);
    if (!check.ok) return { error: check.error };
    const column = String(args?.column || '').trim();
    if (!column || !isSafeIdentifier(column)) return { error: 'Invalid column name' };
    return {
      table: check.table,
      column,
      purpose: describeColumn(check.table, column) || null,
    };
  }
  if (name === 'count_rows') {
    const check = validateTable(args?.table);
    if (!check.ok) return { error: check.error };
    const { from, to } = normalizeDateRange(args);
    let q = db.from(check.table).select('*', { count: 'exact', head: true });
    if (args?.from || args?.to) {
      q = q.gte('created_at', from).lte('created_at', to);
    }
    const res = await q;
    if (res.error) return { error: res.error.message, table: check.table };
    return { table: check.table, count: Number(res.count || 0), from: args?.from ? from : null, to: args?.to ? to : null };
  }
  if (name === 'filtered_rows') {
    const check = validateTable(args?.table);
    if (!check.ok) return { error: check.error };
    const cols = Array.isArray(args?.columns) && args.columns.length
      ? args.columns.filter((c: any) => isSafeIdentifier(String(c || ''))).join(',')
      : '*';
    const limit = Math.max(1, Math.min(200, Number(args?.limit || 50)));
    const orderBy = String(args?.order_by || 'created_at').trim();
    const orderDir = String(args?.order_dir || 'desc').toLowerCase() === 'asc';
    let query = db.from(check.table).select(cols).limit(limit);
    query = applyFilters(query, Array.isArray(args?.filters) ? args.filters : []);
    if (isSafeIdentifier(orderBy)) {
      query = query.order(orderBy, { ascending: orderDir });
    }
    const res = await query;
    if (res.error) return { error: res.error.message, table: check.table };
    return { table: check.table, count: (res.data || []).length, rows: res.data || [] };
  }
  if (name === 'aggregate') {
    const check = validateTable(args?.table);
    if (!check.ok) return { error: check.error };
    const column = String(args?.column || '').trim();
    const metric = String(args?.metric || '').trim();
    if (!isSafeIdentifier(column)) return { error: 'Invalid column name' };
    if (!['sum', 'avg', 'min', 'max'].includes(metric)) return { error: 'Invalid metric' };
    let q = db.from(check.table).select(column).limit(10000);
    q = applyFilters(q, Array.isArray(args?.filters) ? args.filters : []);
    const res = await q;
    if (res.error) return { error: res.error.message, table: check.table };
    const values = (res.data || []).map((r: any) => toNum(r?.[column])).filter((n: number) => Number.isFinite(n));
    if (!values.length) return { table: check.table, column, metric, value: 0, sample_size: 0 };
    const value =
      metric === 'sum'
        ? values.reduce((a: number, b: number) => a + b, 0)
        : metric === 'avg'
          ? values.reduce((a: number, b: number) => a + b, 0) / values.length
          : metric === 'min'
            ? Math.min(...values)
            : Math.max(...values);
    return { table: check.table, column, metric, value, sample_size: values.length };
  }
  if (name === 'recent_activity') {
    const limit = Math.max(5, Math.min(100, Number(args?.limit || 30)));
    const [calls, leads, audits] = await Promise.all([
      db.from('sarv_calls').select('id,callid,cnumber,disposition,created_at').order('created_at', { ascending: false }).limit(limit),
      db.from('service_leads').select('id,lead_number,status,customer_phone,created_at').order('created_at', { ascending: false }).limit(limit),
      db.from('audit_logs').select('id,action,table_name,created_at').order('created_at', { ascending: false }).limit(limit),
    ]);
    return {
      calls: calls.data || [],
      service_leads: leads.data || [],
      audit_logs: audits.data || [],
    };
  }
  if (name === 'finance_snapshot') {
    const forceCurrentMonth =
      Boolean(context?.forceCurrentMonth) || looksLikeCurrentMonthQuery(String(context?.userMessage || ''));
    const { from, to } = forceCurrentMonth ? currentMonthRange() : normalizeDateRange(args);
    const [invoicesPaid, invoicesAll, refunds, payouts] = await Promise.all([
      db.from('invoices').select('paid_amount,final_amount').eq('payment_status', 'PAID').gte('paid_at', from).lte('paid_at', to).limit(10000),
      db.from('invoices').select('id,payment_status,final_amount,created_at').gte('created_at', from).lte('created_at', to).limit(10000),
      db.from('refund_requests').select('id,status,amount,created_at').gte('created_at', from).lte('created_at', to).limit(10000),
      db.from('workshop_payouts').select('id,status,amount,created_at').gte('created_at', from).lte('created_at', to).limit(10000),
    ]);
    const paidRevenue = (invoicesPaid.data || []).reduce(
      (sum: number, r: any) => sum + toNum(r?.paid_amount ?? r?.final_amount),
      0
    );
    const pendingInvoices = (invoicesAll.data || []).filter((r: any) => String(r?.payment_status || '').toUpperCase() !== 'PAID').length;
    const pendingRefundAmount = (refunds.data || [])
      .filter((r: any) => String(r?.status || '').toUpperCase() === 'PENDING')
      .reduce((s: number, r: any) => s + toNum(r?.amount), 0);
    const payoutPendingAmount = (payouts.data || [])
      .filter((r: any) => String(r?.status || '').toUpperCase() === 'PENDING')
      .reduce((s: number, r: any) => s + toNum(r?.amount), 0);
    return {
      from,
      to,
      paid_revenue: paidRevenue,
      total_invoices: (invoicesAll.data || []).length,
      pending_invoices: pendingInvoices,
      pending_refund_amount: pendingRefundAmount,
      pending_payout_amount: payoutPendingAmount,
    };
  }
  if (name === 'rsa_overview_range') {
    const forceCurrentMonth =
      Boolean(context?.forceCurrentMonth) || looksLikeCurrentMonthQuery(String(context?.userMessage || ''));
    const { from, to } = forceCurrentMonth ? currentMonthRange() : normalizeDateRange(args);
    const res = await db
      .from('rsa_leads')
      .select('id,lead_status,complaint_status,lead_registered_at')
      .gte('lead_registered_at', from)
      .lte('lead_registered_at', to)
      .limit(10000);
    if (res.error) return { error: res.error.message };
    const rows = res.data || [];
    const statusMap = new Map<string, number>();
    let completed = 0;
    for (const r of rows) {
      const status = String((r as any)?.lead_status || 'UNKNOWN').trim() || 'UNKNOWN';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
      if (['COMPLETED', 'CLOSED', 'RESOLVED'].includes(status.toUpperCase())) completed += 1;
    }
    return {
      from,
      to,
      total_leads: rows.length,
      completed,
      completion_rate: rows.length ? Number(((completed / rows.length) * 100).toFixed(2)) : 0,
      status_breakdown: Array.from(statusMap.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total),
    };
  }
  if (name === 'workshop_health') {
    const city = String(args?.city || '').trim();
    const limit = Math.max(5, Math.min(100, Number(args?.limit || 30)));
    let query = db
      .from('workshops')
      .select('id,name,city,is_verified,audit_score,created_at')
      .order('audit_score', { ascending: false })
      .limit(limit);
    if (city) query = query.ilike('city', `%${city}%`);
    const res = await query;
    if (res.error) return { error: res.error.message };
    const rows = res.data || [];
    const verified = rows.filter((r: any) => Boolean(r?.is_verified)).length;
    return {
      city: city || null,
      total: rows.length,
      verified,
      verification_rate: rows.length ? Number(((verified / rows.length) * 100).toFixed(2)) : 0,
      workshops: rows,
    };
  }
  if (name === 'employee_performance_summary') {
    const forceCurrentMonth =
      Boolean(context?.forceCurrentMonth) || looksLikeCurrentMonthQuery(String(context?.userMessage || ''));
    const { from, to } = forceCurrentMonth ? currentMonthRange() : normalizeDateRange(args);
    const limit = Math.max(5, Math.min(100, Number(args?.limit || 20)));
    const res = await db
      .from('sarv_calls')
      .select('assigned_user_id,assigned_role,talkduration,disposition,created_at')
      .gte('created_at', from)
      .lte('created_at', to)
      .limit(20000);
    if (res.error) return { error: res.error.message };
    const rows = res.data || [];
    const map = new Map<string, { calls: number; talk: number; role: string }>();
    for (const r of rows) {
      const userId = String((r as any)?.assigned_user_id || 'unassigned');
      const role = String((r as any)?.assigned_role || '');
      const talk = toNum((r as any)?.talkduration);
      const curr = map.get(userId) || { calls: 0, talk: 0, role };
      curr.calls += 1;
      curr.talk += talk;
      if (!curr.role && role) curr.role = role;
      map.set(userId, curr);
    }
    const summary = Array.from(map.entries())
      .map(([assigned_user_id, val]) => ({
        assigned_user_id,
        assigned_role: val.role || null,
        calls_handled: val.calls,
        avg_talkduration_sec: val.calls ? Number((val.talk / val.calls).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.calls_handled - a.calls_handled)
      .slice(0, limit);
    return { from, to, summary };
  }
  if (name === 'call_disposition_city_breakdown') {
    const forceCurrentMonth =
      Boolean(context?.forceCurrentMonth) || looksLikeCurrentMonthQuery(String(context?.userMessage || ''));
    const { from, to } = forceCurrentMonth ? currentMonthRange() : normalizeDateRange(args);
    const { rows, error } = await fetchAllSarvCallsForRange(db, from, to);
    if (error) return { error };
    const callIds = rows.map((r: any) => String(r?.id || '').trim()).filter(Boolean);
    const cityByCallId = await buildCityByCallId(db, callIds);
    const cityByPhone = await buildCityByPhone(db, from, to);
    const byDisp = new Map<string, number>();
    const byCity = new Map<string, number>();
    for (const r of rows) {
      const k = String((r as any)?.disposition || (r as any)?.disposition_category || 'Unspecified').trim() || 'Unspecified';
      byDisp.set(k, (byDisp.get(k) || 0) + 1);
      const callId = String((r as any)?.id || '').trim();
      const city =
        cityByCallId.get(callId) ||
        cityByPhone.get(digits10((r as any)?.cnumber)) ||
        'Unknown';
      byCity.set(city, (byCity.get(city) || 0) + 1);
    }
    return {
      from,
      to,
      total_calls: rows.length,
      disposition: Array.from(byDisp.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total),
      cities: Array.from(byCity.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total),
    };
  }
  if (name === 'business_overview_realtime') {
    const forceCurrentMonth =
      Boolean(context?.forceCurrentMonth) || looksLikeCurrentMonthQuery(String(context?.userMessage || ''));
    const { from, to } = forceCurrentMonth ? currentMonthRange() : normalizeDateRange(args);
    const [callsRes, leadsRes, invoicesRes, refundsRes, payoutsRes, complaintsRes] = await Promise.all([
      fetchAllSarvCallsForRange(db, from, to),
      fetchAllRowsByDateRange({
        db,
        table: 'service_leads',
        select: 'id,status,lead_type,city,workshop_id,created_at',
        dateColumn: 'created_at',
        from,
        to,
      }),
      fetchAllRowsByDateRange({
        db,
        table: 'invoices',
        select: 'id,lead_id,payment_status,paid_amount,final_amount,created_at,paid_at',
        dateColumn: 'created_at',
        from,
        to,
      }),
      fetchAllRowsByDateRange({
        db,
        table: 'refund_requests',
        select: 'id,status,amount,created_at',
        dateColumn: 'created_at',
        from,
        to,
      }),
      fetchAllRowsByDateRange({
        db,
        table: 'workshop_payouts',
        select: 'id,status,amount,created_at',
        dateColumn: 'created_at',
        from,
        to,
      }),
      fetchAllRowsByDateRange({
        db,
        table: 'customer_complaints',
        select: 'id,status,created_at',
        dateColumn: 'created_at',
        from,
        to,
      }),
    ]);

    const calls = callsRes.rows || [];
    const leads = leadsRes.rows || [];
    const invoices = invoicesRes.rows || [];
    const refunds = refundsRes.rows || [];
    const payouts = payoutsRes.rows || [];
    const complaints = complaintsRes.rows || [];

    const completedLeads = leads.filter((r: any) =>
      ['COMPLETED', 'DELIVERED', 'CLOSED'].includes(String(r?.status || '').toUpperCase())
    ).length;
    const paidRevenue = invoices
      .filter((r: any) => String(r?.payment_status || '').toUpperCase() === 'PAID')
      .reduce((sum: number, r: any) => sum + toNum(r?.paid_amount ?? r?.final_amount), 0);
    const pendingRefundAmount = refunds
      .filter((r: any) => String(r?.status || '').toUpperCase() === 'PENDING')
      .reduce((sum: number, r: any) => sum + toNum(r?.amount), 0);
    const pendingPayoutAmount = payouts
      .filter((r: any) => String(r?.status || '').toUpperCase() === 'PENDING')
      .reduce((sum: number, r: any) => sum + toNum(r?.amount), 0);
    const openComplaints = complaints.filter(
      (r: any) => !['CLOSED', 'RESOLVED'].includes(String(r?.status || '').toUpperCase())
    ).length;
    const uniqueCallers = new Set(calls.map((r: any) => digits10(r?.cnumber)).filter(Boolean)).size;

    return {
      from,
      to,
      overview: {
        total_calls: calls.length,
        unique_callers: uniqueCallers,
        total_leads: leads.length,
        completed_leads: completedLeads,
        lead_conversion_rate: leads.length ? Number(((completedLeads / leads.length) * 100).toFixed(2)) : 0,
        paid_revenue: paidRevenue,
        pending_refund_amount: pendingRefundAmount,
        pending_payout_amount: pendingPayoutAmount,
        open_complaints: openComplaints,
      },
      data_quality_notes: [callsRes.error, leadsRes.error, invoicesRes.error, refundsRes.error, payoutsRes.error, complaintsRes.error]
        .filter(Boolean),
    };
  }
  if (name === 'lead_funnel_snapshot') {
    const forceCurrentMonth =
      Boolean(context?.forceCurrentMonth) || looksLikeCurrentMonthQuery(String(context?.userMessage || ''));
    const { from, to } = forceCurrentMonth ? currentMonthRange() : normalizeDateRange(args);
    const leadType = String(args?.lead_type || '').trim().toUpperCase();
    const leadsRes = await fetchAllRowsByDateRange({
      db,
      table: 'service_leads',
      select: 'id,status,lead_type,city,workshop_id,created_at',
      dateColumn: 'created_at',
      from,
      to,
    });
    const baseRows = leadsRes.rows || [];
    const rows = leadType ? baseRows.filter((r: any) => String(r?.lead_type || '').toUpperCase() === leadType) : baseRows;

    const byStatus = new Map<string, number>();
    const byLeadType = new Map<string, number>();
    for (const row of rows) {
      const status = String((row as any)?.status || 'UNKNOWN').trim().toUpperCase();
      const type = String((row as any)?.lead_type || 'UNKNOWN').trim().toUpperCase();
      byStatus.set(status, (byStatus.get(status) || 0) + 1);
      byLeadType.set(type, (byLeadType.get(type) || 0) + 1);
    }
    const completed = rows.filter((r: any) =>
      ['COMPLETED', 'DELIVERED', 'CLOSED'].includes(String(r?.status || '').toUpperCase())
    ).length;
    const cancelled = rows.filter((r: any) =>
      ['CANCELLED', 'REJECTED'].includes(String(r?.status || '').toUpperCase())
    ).length;

    return {
      from,
      to,
      lead_type_filter: leadType || null,
      total_leads: rows.length,
      completed_leads: completed,
      cancelled_leads: cancelled,
      conversion_rate: rows.length ? Number(((completed / rows.length) * 100).toFixed(2)) : 0,
      status_breakdown: Array.from(byStatus.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total),
      lead_type_breakdown: Array.from(byLeadType.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total),
      data_quality_notes: [leadsRes.error].filter(Boolean),
    };
  }
  if (name === 'city_business_snapshot') {
    const forceCurrentMonth =
      Boolean(context?.forceCurrentMonth) || looksLikeCurrentMonthQuery(String(context?.userMessage || ''));
    const { from, to } = forceCurrentMonth ? currentMonthRange() : normalizeDateRange(args);
    const cityArg = String(args?.city || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(100, Number(args?.limit || 20)));

    const [callsRes, leadsRes, invoicesRes] = await Promise.all([
      fetchAllSarvCallsForRange(db, from, to),
      fetchAllRowsByDateRange({
        db,
        table: 'service_leads',
        select: 'id,status,city,created_at',
        dateColumn: 'created_at',
        from,
        to,
      }),
      fetchAllRowsByDateRange({
        db,
        table: 'invoices',
        select: 'id,lead_id,payment_status,paid_amount,final_amount,created_at',
        dateColumn: 'created_at',
        from,
        to,
      }),
    ]);

    const calls = callsRes.rows || [];
    const leads = leadsRes.rows || [];
    const invoices = invoicesRes.rows || [];
    const callIds = calls.map((r: any) => String(r?.id || '').trim()).filter(Boolean);
    const [cityByCallId, cityByPhone] = await Promise.all([
      buildCityByCallId(db, callIds),
      buildCityByPhone(db, from, to),
    ]);

    const leadCityById = new Map<string, string>();
    for (const lead of leads) {
      const id = String((lead as any)?.id || '').trim();
      const city = String((lead as any)?.city || '').trim() || 'Unknown';
      if (id) leadCityById.set(id, city);
    }

    const cityMap = new Map<string, { calls: number; leads: number; completed: number; revenue: number }>();
    const addCity = (cityRaw: string) => {
      const city = cityRaw || 'Unknown';
      const key = city.toUpperCase();
      if (!cityMap.has(key)) cityMap.set(key, { calls: 0, leads: 0, completed: 0, revenue: 0 });
      return cityMap.get(key)!;
    };

    for (const row of calls) {
      const city =
        cityByCallId.get(String((row as any)?.id || '').trim()) ||
        cityByPhone.get(digits10((row as any)?.cnumber)) ||
        'Unknown';
      addCity(city).calls += 1;
    }
    for (const row of leads) {
      const city = String((row as any)?.city || '').trim() || 'Unknown';
      const bucket = addCity(city);
      bucket.leads += 1;
      if (['COMPLETED', 'DELIVERED', 'CLOSED'].includes(String((row as any)?.status || '').toUpperCase())) {
        bucket.completed += 1;
      }
    }
    for (const row of invoices) {
      if (String((row as any)?.payment_status || '').toUpperCase() !== 'PAID') continue;
      const leadId = String((row as any)?.lead_id || '').trim();
      const city = leadCityById.get(leadId) || 'Unknown';
      addCity(city).revenue += toNum((row as any)?.paid_amount ?? (row as any)?.final_amount);
    }

    let cityRows = Array.from(cityMap.entries()).map(([name, v]) => ({
      city: name,
      calls: v.calls,
      leads: v.leads,
      completed_leads: v.completed,
      conversion_rate: v.leads ? Number(((v.completed / v.leads) * 100).toFixed(2)) : 0,
      paid_revenue: Number(v.revenue.toFixed(2)),
    }));
    if (cityArg) {
      cityRows = cityRows.filter((r) => r.city.toLowerCase().includes(cityArg));
    }
    cityRows = cityRows.sort((a, b) => b.paid_revenue - a.paid_revenue || b.leads - a.leads).slice(0, limit);

    return {
      from,
      to,
      city_filter: cityArg || null,
      rows: cityRows,
      data_quality_notes: [callsRes.error, leadsRes.error, invoicesRes.error].filter(Boolean),
    };
  }
  if (name === 'workshop_performance_snapshot') {
    const forceCurrentMonth =
      Boolean(context?.forceCurrentMonth) || looksLikeCurrentMonthQuery(String(context?.userMessage || ''));
    const { from, to } = forceCurrentMonth ? currentMonthRange() : normalizeDateRange(args);
    const cityArg = String(args?.city || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(100, Number(args?.limit || 25)));

    const [leadsRes, workshopsRes, invoicesRes] = await Promise.all([
      fetchAllRowsByDateRange({
        db,
        table: 'service_leads',
        select: 'id,workshop_id,status,city,created_at',
        dateColumn: 'created_at',
        from,
        to,
      }),
      db.from('workshops').select('id,name,city,is_verified').limit(20000),
      fetchAllRowsByDateRange({
        db,
        table: 'invoices',
        select: 'id,lead_id,payment_status,paid_amount,final_amount,created_at',
        dateColumn: 'created_at',
        from,
        to,
      }),
    ]);

    const leads = (leadsRes.rows || []).filter((r: any) => {
      if (!cityArg) return true;
      return String(r?.city || '').toLowerCase().includes(cityArg);
    });
    const workshops = Array.isArray(workshopsRes.data) ? workshopsRes.data : [];
    const workshopById = new Map<string, any>();
    for (const w of workshops) workshopById.set(String((w as any)?.id || ''), w);
    const leadToWorkshop = new Map<string, string>();
    const perf = new Map<string, { leads: number; completed: number; revenue: number }>();

    const getPerf = (wid: string) => {
      if (!perf.has(wid)) perf.set(wid, { leads: 0, completed: 0, revenue: 0 });
      return perf.get(wid)!;
    };

    for (const row of leads) {
      const wid = String((row as any)?.workshop_id || '').trim();
      if (!wid) continue;
      leadToWorkshop.set(String((row as any)?.id || '').trim(), wid);
      const p = getPerf(wid);
      p.leads += 1;
      if (['COMPLETED', 'DELIVERED', 'CLOSED'].includes(String((row as any)?.status || '').toUpperCase())) {
        p.completed += 1;
      }
    }

    for (const inv of invoicesRes.rows || []) {
      if (String((inv as any)?.payment_status || '').toUpperCase() !== 'PAID') continue;
      const leadId = String((inv as any)?.lead_id || '').trim();
      const wid = leadToWorkshop.get(leadId);
      if (!wid) continue;
      getPerf(wid).revenue += toNum((inv as any)?.paid_amount ?? (inv as any)?.final_amount);
    }

    const rows = Array.from(perf.entries())
      .map(([workshop_id, m]) => {
        const info = workshopById.get(workshop_id);
        return {
          workshop_id,
          workshop_name: String(info?.name || 'Unknown workshop'),
          city: String(info?.city || 'Unknown'),
          is_verified: Boolean(info?.is_verified),
          leads: m.leads,
          completed_leads: m.completed,
          completion_rate: m.leads ? Number(((m.completed / m.leads) * 100).toFixed(2)) : 0,
          paid_revenue: Number(m.revenue.toFixed(2)),
        };
      })
      .sort((a, b) => b.paid_revenue - a.paid_revenue || b.leads - a.leads)
      .slice(0, limit);

    return {
      from,
      to,
      city_filter: cityArg || null,
      rows,
      data_quality_notes: [leadsRes.error, workshopsRes.error?.message, invoicesRes.error].filter(Boolean),
    };
  }
  if (name === 'risk_alerts_snapshot') {
    const forceCurrentMonth =
      Boolean(context?.forceCurrentMonth) || looksLikeCurrentMonthQuery(String(context?.userMessage || ''));
    const { from, to } = forceCurrentMonth ? currentMonthRange() : normalizeDateRange(args);
    const [refundsRes, payoutsRes, complaintsRes, leadsRes] = await Promise.all([
      fetchAllRowsByDateRange({
        db,
        table: 'refund_requests',
        select: 'id,status,amount,created_at',
        dateColumn: 'created_at',
        from,
        to,
      }),
      fetchAllRowsByDateRange({
        db,
        table: 'workshop_payouts',
        select: 'id,status,amount,created_at',
        dateColumn: 'created_at',
        from,
        to,
      }),
      fetchAllRowsByDateRange({
        db,
        table: 'customer_complaints',
        select: 'id,status,created_at',
        dateColumn: 'created_at',
        from,
        to,
      }),
      fetchAllRowsByDateRange({
        db,
        table: 'service_leads',
        select: 'id,status,created_at',
        dateColumn: 'created_at',
        from,
        to,
      }),
    ]);

    const nowMs = Date.now();
    const overdueHours = 72;
    const overdueLeads = (leadsRes.rows || []).filter((r: any) => {
      const status = String(r?.status || '').toUpperCase();
      if (['COMPLETED', 'DELIVERED', 'CLOSED', 'CANCELLED', 'REJECTED'].includes(status)) return false;
      const createdAtMs = new Date(String(r?.created_at || '')).getTime();
      if (!Number.isFinite(createdAtMs)) return false;
      return nowMs - createdAtMs > overdueHours * 3600 * 1000;
    });

    const pendingRefundAmount = (refundsRes.rows || [])
      .filter((r: any) => String(r?.status || '').toUpperCase() === 'PENDING')
      .reduce((sum: number, r: any) => sum + toNum(r?.amount), 0);
    const pendingPayoutAmount = (payoutsRes.rows || [])
      .filter((r: any) => String(r?.status || '').toUpperCase() === 'PENDING')
      .reduce((sum: number, r: any) => sum + toNum(r?.amount), 0);
    const unresolvedComplaints = (complaintsRes.rows || []).filter(
      (r: any) => !['CLOSED', 'RESOLVED'].includes(String(r?.status || '').toUpperCase())
    );

    return {
      from,
      to,
      alerts: {
        pending_refunds: {
          count: (refundsRes.rows || []).filter((r: any) => String(r?.status || '').toUpperCase() === 'PENDING').length,
          amount: Number(pendingRefundAmount.toFixed(2)),
        },
        pending_payouts: {
          count: (payoutsRes.rows || []).filter((r: any) => String(r?.status || '').toUpperCase() === 'PENDING').length,
          amount: Number(pendingPayoutAmount.toFixed(2)),
        },
        unresolved_complaints: unresolvedComplaints.length,
        overdue_open_leads_72h: overdueLeads.length,
      },
      data_quality_notes: [refundsRes.error, payoutsRes.error, complaintsRes.error, leadsRes.error].filter(Boolean),
    };
  }
  return { error: `Unknown tool "${name}"` };
}

export async function POST(request: NextRequest) {
  const auth = await assertSuperAdminAccess();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: error || 'Admin DB client missing' }, { status: 500 });
  }
  const db = supabaseAdmin as any;

  try {
    const startedAt = Date.now();
    const body = await request.json().catch(() => ({}));
    const message = String(body?.message || '').trim();
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    const selectedModel = resolveModel(body?.model);

    const requestedConversationId = String(body?.conversationId || '').trim();
    const conversationId = isUuid(requestedConversationId) ? requestedConversationId : makeConversationId();
    const previous = (await getAdminChatMessages({ userId: auth.userId, conversationId, limit: 80 }).catch(
      () => []
    )) as StoredAdminMessage[];

    const callAnalyticsIntent = isCallAnalyticsIntent(message);
    const financeIntent = isFinanceIntent(message);

    const forceCurrentMonthContext =
      isCurrentMonthCallIntent(message) ||
      (!hasExplicitDateReference(message) &&
        hasRecentCurrentMonthContext(previous) &&
        (isFollowUpCallBreakdownIntent(message) || isFollowUpBusinessIntent(message)));

    const historyMessages: ChatMessage[] = previous
      .slice(-20)
      .filter((m: StoredAdminMessage) => {
        if (!forceCurrentMonthContext) return true;
        if (m.role !== 'assistant') return true;
        return !/october\s+2023/i.test(String(m.text || ''));
      })
      .slice(-14)
      .map((m: StoredAdminMessage) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.text || ''),
      }));

    const messages: ChatMessage[] = [
      { role: 'system', content: OWNER_SYSTEM_PROMPT },
      forceCurrentMonthContext
        ? {
            role: 'system',
            content:
              'For this request and follow-ups in this thread, treat reporting range as current month unless user explicitly asks another date.',
          }
        : null,
      ...historyMessages,
      { role: 'user', content: message },
    ].filter(Boolean) as ChatMessage[];

    await appendAdminChatMessage({
      userId: auth.userId,
      conversationId,
      role: 'user',
      text: message,
      titleHint: message,
    });

    if (isConversationSummaryIntent(message)) {
      const transcript = buildSummaryTranscript(previous);
      const summaryPrompt: ChatMessage[] = [
        {
          role: 'system',
          content:
            'You summarize an owner/admin operations chat. Provide concise Hinglish bullets: 1) user asks, 2) data findings, 3) decisions/fixes, 4) pending follow-ups. Keep factual, no hallucinations.',
        },
        {
          role: 'user',
          content: transcript
            ? `Summarize this same conversation thread:\n\n${transcript}`
            : 'No previous conversation messages found.',
        },
      ];
      const summaryAssistant = await createPlainCompletion(summaryPrompt, selectedModel);
      const summaryReply =
        String(summaryAssistant?.content || '').trim() ||
        (transcript
          ? 'Summary generate nahi ho paya, please retry.'
          : 'Is chat me abhi summarize karne layak previous messages nahi hain.');
      const summaryTrace = [{ tool: 'conversation_summary', ok: true }];
      await appendAdminChatMessage({
        userId: auth.userId,
        conversationId,
        role: 'assistant',
        text: summaryReply,
        toolTrace: summaryTrace,
      });
      await db.from('audit_logs').insert({
        user_id: auth.userId,
        action: 'ADMIN_AI_CHAT_REQUEST',
        table_name: 'admin_ai_chat',
        record_id: conversationId,
        session_id: conversationId,
        action_category: 'DATA',
        severity: 'LOW',
        execution_time_ms: Date.now() - startedAt,
        new_data: {
          question: message,
          tool_trace: summaryTrace,
          mode: 'conversation_summary',
          model: selectedModel,
        },
      });
      return NextResponse.json(
        { conversationId, reply: summaryReply, toolTrace: summaryTrace, model: selectedModel },
        { status: 200 }
      );
    }

    const shouldRunDeterministicCallSummary =
      forceCurrentMonthContext && (callAnalyticsIntent || isFollowUpCallBreakdownIntent(message));

    if (shouldRunDeterministicCallSummary) {
      const { from, to } = currentMonthRange();
      const { rows, error: rowsError } = await fetchAllSarvCallsForRange(db, from, to);
      if (rowsError) {
        throw new Error(rowsError);
      }
      const callIds = rows.map((r: any) => String(r?.id || '').trim()).filter(Boolean);
      const cityByCallId = await buildCityByCallId(db, callIds);
      const cityByPhone = await buildCityByPhone(db, from, to);

      const cityCounts = new Map<string, number>();
      const dispositionCounts = new Map<string, number>();
      const reasonCounts = new Map<string, number>();
      for (const row of rows) {
        const callId = String((row as any)?.id || '').trim();
        const city = cityByCallId.get(callId) || cityByPhone.get(digits10((row as any)?.cnumber)) || 'Unknown';
        cityCounts.set(city, (cityCounts.get(city) || 0) + 1);

        const disposition = String((row as any)?.disposition || (row as any)?.disposition_category || '').trim() || 'Unspecified';
        const reason = String((row as any)?.disposition_category || '').trim() || 'Unspecified';
        dispositionCounts.set(disposition, (dispositionCounts.get(disposition) || 0) + 1);
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      }

      const cityRows = Array.from(cityCounts.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total);
      const dispositionRows = Array.from(dispositionCounts.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total);
      const reasonRows = Array.from(reasonCounts.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total);

      const topCity = cityRows[0];
      const topDisposition = dispositionRows[0];
      const msg = message.toLowerCase();
      const askCityWise = /(city|shahar|location)/.test(msg) && /(pura|all|sabhi|wise|baki|complete|full)/.test(msg);
      const askDispositionWise = /(disposition|reason)/.test(msg);

      const lines: string[] = [
        `Current month total calls: ${rows.length}`,
        topCity ? `Sabse zyada calls city: ${topCity.name} (${topCity.total})` : 'City breakup unavailable',
        topDisposition ? `Top disposition: ${topDisposition.name} (${topDisposition.total})` : 'Disposition breakup unavailable',
      ];

      if (askCityWise) {
        lines.push('', 'City-wise calls:');
        for (const row of cityRows) {
          lines.push(`- ${row.name}: ${row.total}`);
        }
      }

      if (askDispositionWise) {
        lines.push('', 'Disposition-wise calls:');
        for (const row of dispositionRows) {
          lines.push(`- ${row.name}: ${row.total}`);
        }
        lines.push('', 'Disposition reason/category-wise calls:');
        for (const row of reasonRows) {
          lines.push(`- ${row.name}: ${row.total}`);
        }
      }

      lines.push(``, `Range used: ${from} to ${to}`);

      const deterministicReply = lines.join('\n');

      const deterministicTrace = [{ tool: 'deterministic_current_month_call_summary', ok: true }];
      await appendAdminChatMessage({
        userId: auth.userId,
        conversationId,
        role: 'assistant',
        text: deterministicReply,
        toolTrace: deterministicTrace,
      });
      await db.from('audit_logs').insert({
        user_id: auth.userId,
        action: 'ADMIN_AI_CHAT_REQUEST',
        table_name: 'admin_ai_chat',
        record_id: conversationId,
        session_id: conversationId,
        action_category: 'DATA',
        severity: 'LOW',
        execution_time_ms: Date.now() - startedAt,
        new_data: {
          question: message,
          tool_trace: deterministicTrace,
          mode: 'deterministic_current_month_call_summary',
          model: selectedModel,
        },
      });
      return NextResponse.json(
        { conversationId, reply: deterministicReply, toolTrace: deterministicTrace, model: selectedModel },
        { status: 200 }
      );
    }

    let assistant = await createCompletion(messages, selectedModel);
    const toolTrace: Array<{ tool: string; ok: boolean }> = [];
    let loops = 0;
    while (assistant?.tool_calls?.length && loops < 8) {
      loops += 1;
      messages.push({
        role: 'assistant',
        content: String(assistant.content || ''),
        tool_calls: assistant.tool_calls,
      });
      for (const call of assistant.tool_calls) {
        const tool = String(call?.function?.name || '');
        const args = safeJsonParse(call?.function?.arguments || '{}');
        const result = await runTool(db, tool, args, {
          userMessage: message,
          forceCurrentMonth:
            forceCurrentMonthContext &&
            (tool === 'call_disposition_city_breakdown' ||
              tool === 'employee_performance_summary' ||
              tool === 'rsa_overview_range' ||
              (tool === 'finance_snapshot' && financeIntent)),
        });
        toolTrace.push({ tool, ok: !result?.error });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
      assistant = await createCompletion(messages, selectedModel);
    }

    let reply = String(assistant?.content || '').trim() || 'No response generated.';
    if (forceCurrentMonthContext && /october\s+2023/i.test(reply) && !hasExplicitDateReference(message)) {
      reply = reply.replace(/october\s+2023/gi, 'current month');
      if (!/range used:/i.test(reply)) {
        const r = currentMonthRange();
        reply = `${reply}\nRange used: ${r.from} to ${r.to}`;
      }
    }
    await appendAdminChatMessage({
      userId: auth.userId,
      conversationId,
      role: 'assistant',
      text: reply,
      toolTrace,
    });

    await db.from('audit_logs').insert({
      user_id: auth.userId,
      action: 'ADMIN_AI_CHAT_REQUEST',
      table_name: 'admin_ai_chat',
      record_id: conversationId,
      session_id: conversationId,
      action_category: 'DATA',
      severity: 'LOW',
      execution_time_ms: Date.now() - startedAt,
      new_data: {
        question: message,
        tool_trace: toolTrace,
        model: selectedModel,
      },
    });

    return NextResponse.json({ conversationId, reply, toolTrace, model: selectedModel }, { status: 200 });
  } catch (e: any) {
    await db.from('audit_logs').insert({
      user_id: auth.userId,
      action: 'ADMIN_AI_CHAT_ERROR',
      table_name: 'admin_ai_chat',
      action_category: 'SECURITY',
      severity: 'HIGH',
      error_message: String(e?.message || 'Unknown admin ai error'),
      new_data: {
        error_class: String(e?.name || 'Error'),
      },
    });
    return NextResponse.json({ error: e?.message || 'Failed to process chat request' }, { status: 500 });
  }
}
