import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendTemplateMessage } from '@/lib/services/whatsappService';
import { getResolvedWhatsAppAgentsCredentials } from '@/lib/whatsappAgents/shared/envConfigStore';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];
const BATCH_SIZE = 20;
const MAX_PASTE = 200000;

function tablesMissing(error: { message?: string; code?: string } | null | undefined) {
  const msg = `${error?.code || ''} ${error?.message || ''}`;
  return /does not exist|42P01|PGRST205/i.test(msg);
}

function toPhone(raw: string) {
  const digits = String(raw || '').replace(/\D/g, '');
  const last10 = digits.slice(-10);
  if (last10.length !== 10 || !/^[6-9]/.test(last10)) return '';
  return `91${last10}`;
}

function splitCsv(line: string) {
  const out: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if ((char === ',' || char === ';' || char === '\t') && !quoted) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  out.push(current.trim());
  return out;
}

function headerKind(cell: string) {
  const value = cell.toLowerCase().trim();
  if (/phone|mobile|whatsapp/.test(value) || /^contact( no| number)?$/.test(value)) return 'phone';
  if ((/^name$|customer.?name|full.?name|^customer$/).test(value) && !/car|vehicle/.test(value)) return 'name';
  return 'field';
}

async function writeSegment(db: any, input: { name: string; description?: string; condition_count?: number }, id = '') {
  const row = {
    name: input.name,
    description: String(input.description || input.name).slice(0, 180),
    condition_count: Math.max(0, Number(input.condition_count ?? 1) || 0),
  };
  const select = 'id, name, description, condition_count';
  let saved = id
    ? await db.from('wa_bulk_segments').update(row).eq('id', id).select(select).maybeSingle()
    : await db.from('wa_bulk_segments').insert(row).select(select).maybeSingle();
  if (saved.error && /description|condition_count/i.test(saved.error.message || '')) {
    saved = id
      ? await db.from('wa_bulk_segments').update({ name: input.name }).eq('id', id).select('id, name').maybeSingle()
      : await db.from('wa_bulk_segments').insert({ name: input.name }).select('id, name').maybeSingle();
  }
  return saved;
}

function fieldKey(header: string) {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

function parseContactLines(text: string) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows: Array<{ name: string; phone: string; fields: Record<string, string> }> = [];
  const seen = new Set<string>();
  const samples: Record<string, string[]> = {};
  let nameIndex = -1;
  let phoneIndex = -1;
  let headers: string[] = [];
  let start = 0;
  if (lines.length) {
    headers = splitCsv(lines[0]);
    const kinds = headers.map((cell) => headerKind(cell));
    phoneIndex = kinds.findIndex((kind) => kind === 'phone');
    nameIndex = kinds.findIndex((kind) => kind === 'name');
    if (phoneIndex >= 0) start = 1;
  }
  for (const line of lines.slice(start)) {
    const parts = splitCsv(line);
    let name = '';
    let phoneRaw = line;
    const fields: Record<string, string> = {};
    if (phoneIndex >= 0) {
      phoneRaw = parts[phoneIndex] || '';
      name = nameIndex >= 0 ? parts[nameIndex] || '' : '';
      headers.forEach((header, index) => {
        if (index === phoneIndex || index === nameIndex) return;
        const key = fieldKey(header);
        const value = String(parts[index] || '').trim();
        if (key && value) {
          fields[key] = value.slice(0, 180);
          samples[key] = samples[key] || [];
          if (samples[key].length < 20) samples[key].push(value);
        }
      });
    } else if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      if (toPhone(last)) {
        phoneRaw = last;
        name = parts.slice(0, -1).join(' ');
      }
    }
    const phone = toPhone(phoneRaw);
    if (!phone) continue;
    if (seen.has(phone)) {
      if (name) {
        const existing = rows.find((row) => row.phone === phone);
        if (existing && !existing.name) existing.name = name.slice(0, 80);
      }
      continue;
    }
    seen.add(phone);
    rows.push({ name: name.slice(0, 80), phone, fields });
    if (rows.length >= MAX_PASTE) break;
  }
  const fieldDefs = headers
    .map((header, index) => ({ header, index, kind: headerKind(header) }))
    .filter((item) => item.kind === 'field' && phoneIndex >= 0)
    .map((item) => {
      const key = fieldKey(item.header);
      const values = samples[key] || [];
      const numeric = values.length > 0 && values.every((value) => /^-?\d+(\.\d+)?$/.test(value));
      return { key, title: item.header.trim().slice(0, 80), field_type: numeric ? 'NUMBER' : 'STRING' };
    })
    .filter((item) => item.key);
  return { rows, fieldDefs };
}

async function selectIn(db: any, table: string, columns: string, column: string, values: string[]) {
  const rows: any[] = [];
  for (let index = 0; index < values.length; index += 200) {
    const slice = values.slice(index, index + 200);
    const result = await db.from(table).select(columns).in(column, slice);
    if (result.error) return { data: null as any[] | null, error: result.error };
    rows.push(...(result.data || []));
  }
  return { data: rows, error: null };
}

function fillParams(params: string[], name: string, fields: Record<string, string> = {}) {
  const bag: Record<string, string> = { name: name.trim() || 'there', ...fields };
  return params.map((value) =>
    String(value ?? '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key) => bag[String(key).toLowerCase()] || ''),
  );
}

function headerImageFrom(meta: { header_image_url?: string; raw?: { components?: Array<{ type?: string; format?: string }> } } | null | undefined) {
  return String(meta?.header_image_url || '').trim();
}

function templateNeedsImage(meta: { header_image_url?: string; raw?: { components?: Array<{ type?: string; format?: string }> } } | null | undefined) {
  const header = meta?.raw?.components?.find((item) => String(item?.type || '').toUpperCase() === 'HEADER');
  return String(header?.format || '').toUpperCase() === 'IMAGE' || Boolean(headerImageFrom(meta));
}

function chosenHeaderImage(body: { header_image_url?: string } | null | undefined, meta: { header_image_url?: string } | null | undefined) {
  const requested = String(body?.header_image_url || '').trim();
  if (/^https?:\/\//i.test(requested)) return requested;
  return headerImageFrom(meta);
}

const DEFAULT_SENDING_NUMBER = '+91 95949 96161';

function prettyIndianPhone(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  const last10 = digits.slice(-10);
  if (last10.length !== 10) return String(value || '').trim();
  return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
}

function publicAccount(row: any, active: boolean) {
  return {
    id: String(row.id),
    label: String(row.label || row.verified_name || 'WhatsApp'),
    display_phone: String(row.display_phone || ''),
    verified_name: String(row.verified_name || ''),
    phone_number_id_last4: String(row.phone_number_id || '').slice(-4),
    quality_rating: String(row.quality_rating || ''),
    is_active: active,
    source: 'connected',
  };
}

async function listSendingAccounts(db: any) {
  const saved = await db
    .from('wa_bulk_accounts')
    .select('id, label, display_phone, verified_name, phone_number_id, quality_rating, is_active, created_at')
    .order('created_at', { ascending: true });
  const settingsAccount = {
    id: 'settings',
    label: 'WhatsApp settings',
    display_phone: DEFAULT_SENDING_NUMBER,
    verified_name: 'My FNG Autocare',
    phone_number_id_last4: '',
    quality_rating: '',
    is_active: true,
    source: 'settings',
  };
  if (saved.error) {
    return { accounts: [settingsAccount], ready: false, missing: tablesMissing(saved.error) || /wa_bulk_accounts/i.test(saved.error.message || ''), error: saved.error, active: settingsAccount };
  }
  const rows = saved.data || [];
  const activeRow = rows.find((row: { is_active?: boolean }) => row.is_active);
  const accounts = [
    { ...settingsAccount, is_active: !activeRow },
    ...rows.map((row: any) => publicAccount(row, Boolean(row.is_active))),
  ];
  const active = accounts.find((account) => account.is_active) || accounts[0];
  return { accounts, ready: true, missing: false, error: null, active };
}

function limitLabel(tier: string) {
  const labels: Record<string, string> = {
    TIER_50: '50',
    TIER_250: '250',
    TIER_1K: '1,000',
    TIER_1000: '1,000',
    TIER_2K: '2,000',
    TIER_10K: '10,000',
    TIER_100K: '1 Lakh',
    TIER_UNLIMITED: 'Unlimited',
  };
  return labels[String(tier || '').toUpperCase()] || '';
}

async function phoneProfile(phoneNumberId: string, accessToken: string, apiUrl?: string) {
  const base = String(apiUrl || 'https://graph.facebook.com/v25.0').replace(/\/$/, '');
  if (!phoneNumberId || !accessToken) return { limit_label: 'Limit not available', account_status: '', quality_rating: '' };
  try {
    const response = await fetch(`${base}/${phoneNumberId}?fields=quality_rating,whatsapp_business_manager_messaging_limit,messaging_limit_tier,status,verified_name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return { limit_label: 'Limit not available', account_status: '', quality_rating: '' };
    const tier = String(json.whatsapp_business_manager_messaging_limit || json.messaging_limit_tier || '');
    return {
      quality_rating: String(json.quality_rating || ''),
      account_status: String(json.status || ''),
      verified_name: String(json.verified_name || ''),
      limit_label: limitLabel(tier) || 'Limit not published',
    };
  } catch {
    return { limit_label: 'Limit not available', account_status: '', quality_rating: '' };
  }
}

async function withAccountLimits(db: any, state: { accounts: any[]; ready: boolean; active?: any }) {
  const creds = await getResolvedWhatsAppAgentsCredentials();
  const secrets = await db.from('wa_bulk_accounts').select('id, phone_number_id, access_token, api_url');
  const byId = new Map<string, { phone_number_id?: string; access_token?: string; api_url?: string }>(
    (secrets.data || []).map((row: { id: string; phone_number_id?: string; access_token?: string; api_url?: string }) => [row.id, row]),
  );
  const accounts = await Promise.all(state.accounts.map(async (account) => {
    const secret = account.id === 'settings'
      ? { phone_number_id: creds.whatsapp_phone_number_id, access_token: creds.whatsapp_access_token, api_url: creds.whatsapp_api_url }
      : byId.get(account.id);
    const profile = await phoneProfile(String(secret?.phone_number_id || ''), String(secret?.access_token || ''), secret?.api_url);
    return {
      ...account,
      quality_rating: profile.quality_rating || account.quality_rating || '',
      verified_name: account.verified_name || profile.verified_name || '',
      limit_label: profile.limit_label,
      account_status: profile.account_status || '',
    };
  }));
  return { ...state, accounts };
}

async function loadActiveSender(db: any) {
  const row = await db
    .from('wa_bulk_accounts')
    .select('phone_number_id, access_token, api_url')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (row.error || !row.data?.access_token || !row.data?.phone_number_id) return undefined;
  return {
    phoneNumberId: String(row.data.phone_number_id),
    accessToken: String(row.data.access_token),
    apiUrl: String(row.data.api_url || 'https://graph.facebook.com/v25.0'),
  };
}

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('users_login')
    .select('id, full_name, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();
  const role = String((profile as any)?.roles?.role_code || '').toUpperCase();
  if (!profile || !ALLOWED_ROLES.includes(role)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false as const, status: 500, error: error || 'Database admin unavailable' };
  return {
    ok: true as const,
    db: supabaseAdmin as any,
    userId: (profile as any).id as string,
    actorName: String((profile as any).full_name || ''),
    role,
  };
}

function missingResponse() {
  return NextResponse.json(
    {
      error: 'Bulk WhatsApp tables are missing. Run database/388_whatsapp_bulk_send.sql in Supabase.',
      tables_missing: true,
    },
    { status: 503 },
  );
}

function istInstant(value: string, end: boolean) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T${end ? '23:59:59.999' : '00:00:00'}+05:30`).toISOString();
  }
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?/);
  if (!match) return '';
  return new Date(`${match[1]}T${match[2]}:${match[3] || '00'}+05:30`).toISOString();
}

function applyContactFilters(query: any, filters: { q?: string; from?: string; to?: string; uploadId?: string }) {
  let next = query;
  if (filters.uploadId) next = next.eq('upload_id', filters.uploadId);
  const from = istInstant(filters.from || '', false);
  const to = istInstant(filters.to || '', true);
  if (from) next = next.gte('created_at', from);
  if (to) next = next.lte('created_at', to);
  const q = String(filters.q || '').replace(/[%_,]/g, '').trim();
  if (q) next = next.or(`phone.ilike.%${q}%,name.ilike.%${q}%`);
  return next;
}

async function listFilteredContactIds(db: any, filters: { q?: string; from?: string; to?: string; uploadId?: string }) {
  const ids: string[] = [];
  for (let offset = 0; offset < 200000; offset += 1000) {
    const result = await applyContactFilters(
      db.from('wa_bulk_contacts').select('id').order('created_at', { ascending: false }),
      filters,
    ).range(offset, offset + 999);
    if (result.error) return { ids, error: result.error };
    const rows = result.data || [];
    ids.push(...rows.map((row: { id: string }) => row.id));
    if (rows.length < 1000) break;
  }
  return { ids, error: null };
}

async function loadSegmentContactIds(db: any, segmentId: string) {
  const ids: string[] = [];
  for (let offset = 0; offset < 200000; offset += 1000) {
    const result = await db
      .from('wa_bulk_segment_contacts')
      .select('contact_id')
      .eq('segment_id', segmentId)
      .range(offset, offset + 999);
    if (result.error) return { ids, error: result.error };
    const rows = result.data || [];
    ids.push(...rows.map((row: { contact_id: string }) => row.contact_id));
    if (rows.length < 1000) break;
  }
  return { ids, error: null };
}

async function campaignReport(db: any, campaignId: string) {
  const campaign = await db
    .from('wa_bulk_campaigns')
    .select('id, name, template_name, status, total, sent, failed, skipped, created_at, finished_at')
    .eq('id', campaignId)
    .maybeSingle();
  if (campaign.error) return { error: campaign.error };
  if (!campaign.data) return { error: { message: 'Campaign not found' } };

  const buckets = { sent: 0, failed: 0, skipped: 0, pending: 0, replied: 0, delivered: 0, read: 0, auto: 0 };
  const replies: Record<string, number> = {};
  const messageIds: string[] = [];
  for (let offset = 0; offset < 200000; offset += 1000) {
    let page = await db
      .from('wa_bulk_recipients')
      .select('status, reply_button, message_id, delivery_status, reply_kind')
      .eq('campaign_id', campaignId)
      .range(offset, offset + 999);
    if (page.error && /reply_kind/i.test(page.error.message || '')) {
      page = await db
        .from('wa_bulk_recipients')
        .select('status, reply_button, message_id, delivery_status')
        .eq('campaign_id', campaignId)
        .range(offset, offset + 999);
    }
    if (page.error && /delivery_status/i.test(page.error.message || '')) {
      const fallback = await db
        .from('wa_bulk_recipients')
        .select('status, reply_button, message_id')
        .eq('campaign_id', campaignId)
        .range(offset, offset + 999);
      if (fallback.error) return { error: fallback.error };
      for (const row of fallback.data || []) {
        const status = String(row.status || 'pending');
        if (status === 'sent' || status === 'failed' || status === 'skipped' || status === 'pending') buckets[status] += 1;
        const reply = String(row.reply_button || '').trim();
        if (reply) {
          buckets.replied += 1;
          replies[reply] = (replies[reply] || 0) + 1;
        }
        if (row.message_id) messageIds.push(String(row.message_id));
      }
      if ((fallback.data || []).length < 1000) break;
      continue;
    }
    if (page.error) return { error: page.error };
    for (const row of page.data || []) {
      const status = String(row.status || 'pending');
      if (status === 'sent' || status === 'failed' || status === 'skipped' || status === 'pending') buckets[status] += 1;
      const reply = String(row.reply_button || '').trim();
      if (String(row.reply_kind || '') === 'auto') buckets.auto += 1;
      else if (reply) {
        buckets.replied += 1;
        replies[reply] = (replies[reply] || 0) + 1;
      }
      const delivery = String(row.delivery_status || '').toUpperCase();
      if (delivery === 'DELIVERED' || delivery === 'VIEWED' || delivery === 'READ') buckets.delivered += 1;
      if (delivery === 'VIEWED' || delivery === 'READ') buckets.read += 1;
      if (!delivery && row.message_id) messageIds.push(String(row.message_id));
    }
    if ((page.data || []).length < 1000) break;
  }

  if (messageIds.length) {
    for (let index = 0; index < messageIds.length; index += 200) {
      const slice = messageIds.slice(index, index + 200);
      const messages = await db.from('whatsapp_messages').select('status').in('provider_message_id', slice);
      if (messages.error) break;
      for (const row of messages.data || []) {
        const status = String(row.status || '').toUpperCase();
        if (status === 'DELIVERED' || status === 'VIEWED' || status === 'READ') buckets.delivered += 1;
        if (status === 'VIEWED' || status === 'READ') buckets.read += 1;
      }
    }
  }

  const audience = buckets.sent + buckets.failed + buckets.skipped + buckets.pending || Number(campaign.data.total || 0);
  const pct = (value: number) => (audience ? Math.round((value / audience) * 1000) / 10 : 0);
  return {
    campaign: campaign.data,
    audience,
    ...buckets,
    replies: Object.entries(replies)
      .map(([button, count]) => ({ button, count, percent: pct(count) }))
      .sort((a, b) => b.count - a.count),
    rates: {
      sent: pct(buckets.sent),
      delivered: pct(buckets.delivered),
      read: pct(buckets.read),
      replied: pct(buckets.replied),
      auto: pct(buckets.auto),
      failed: pct(buckets.failed),
      skipped: pct(buckets.skipped),
    },
  };
}

function applyLeadFilters(
  query: any,
  filters: { q?: string; from?: string; to?: string; status?: string; city?: string; source?: string; crm?: string },
  includeDeleted = false,
) {
  let next = includeDeleted ? query : query.is('deleted_at', null);
  const from = istInstant(filters.from || '', false);
  const to = istInstant(filters.to || '', true);
  if (from) next = next.gte('created_at', from);
  if (to) next = next.lte('created_at', to);
  const status = String(filters.status || '').trim().toUpperCase();
  if (status && status !== 'ALL') next = next.eq('status', status);
  const city = String(filters.city || '').replace(/[%_,]/g, '').trim();
  if (city) next = next.ilike('city', `%${city}%`);
  const source = String(filters.source || '').replace(/[%_,]/g, '').trim();
  if (source) next = next.ilike('lead_source', `%${source}%`);
  const crm = String(filters.crm || '').trim().toUpperCase();
  if (crm && crm !== 'ALL' && crm !== 'FRESH') next = next.eq('coupon_meta->>last_call_result', crm);
  const q = String(filters.q || '').replace(/[%_,]/g, '').trim();
  if (q) next = next.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,lead_number.ilike.%${q}%`);
  return next;
}

async function collectLeadContacts(db: any, filters: { q?: string; from?: string; to?: string; status?: string; city?: string; source?: string; crm?: string }) {
  const people: Array<{ phone: string; name: string }> = [];
  const seen = new Set<string>();
  let includeDeleted = false;
  for (let offset = 0; offset < 20000; offset += 1000) {
    const run = (withDeleted: boolean) =>
      applyLeadFilters(
        db.from('service_leads').select('customer_name, customer_phone, coupon_meta').order('created_at', { ascending: false }),
        filters,
        withDeleted,
      ).range(offset, offset + 999);
    let result = await run(includeDeleted);
    if (result.error && /deleted_at/i.test(result.error.message || '')) {
      includeDeleted = true;
      result = await run(true);
    }
    if (result.error) return { people, error: result.error };
    for (const row of result.data || []) {
      if (String(filters.crm || '').toUpperCase() === 'FRESH') {
        const resultCode = String(row.coupon_meta?.last_call_result || 'FRESH').toUpperCase();
        if (resultCode !== 'FRESH') continue;
      }
      const phone = toPhone(String(row.customer_phone || ''));
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      people.push({ phone, name: String(row.customer_name || '').slice(0, 80) });
    }
    if ((result.data || []).length < 1000) break;
  }
  return { people, error: null };
}

export async function GET(request: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = auth.db;
  const params = request.nextUrl.searchParams;
  const section = params.get('section') || 'home';

  if (section === 'campaign') {
    const id = String(params.get('id') || '').trim();
    if (!id) return NextResponse.json({ error: 'Campaign id is required' }, { status: 400 });
    const report = await campaignReport(db, id);
    if (report.error) {
      if (tablesMissing(report.error)) return missingResponse();
      const status = /not found/i.test(report.error.message || '') ? 404 : 500;
      return NextResponse.json({ error: report.error.message }, { status });
    }
    return NextResponse.json({ success: true, report });
  }

  if (section === 'audience') {
    const id = String(params.get('id') || '').trim();
    if (!id) return NextResponse.json({ error: 'Campaign id is required' }, { status: 400 });
    const view = String(params.get('view') || 'all').toLowerCase();
    const page = Math.max(1, Number(params.get('page') || 1));
    const limit = 40;
    const from = (page - 1) * limit;
    let query = db
      .from('wa_bulk_recipients')
      .select('id, name, phone, status, reply_button, delivery_status, sent_at, replied_at', { count: 'exact' })
      .eq('campaign_id', id);
    if (view === 'sent') query = query.eq('status', 'sent');
    if (view === 'failed') query = query.eq('status', 'failed');
    if (view === 'replied') query = query.not('reply_button', 'is', null);
    if (view === 'delivered') query = query.in('delivery_status', ['DELIVERED', 'VIEWED', 'READ']);
    if (view === 'read') query = query.in('delivery_status', ['VIEWED', 'READ']);
    if (view === 'auto') query = query.eq('reply_kind', 'auto');
    query = query.order('sent_at', { ascending: false }).range(from, from + limit - 1);
    const rows = await query;
    if (rows.error && /reply_kind/i.test(rows.error.message || '') && view === 'auto') {
      return NextResponse.json({ success: true, rows: [], total: 0, page });
    }
    if (rows.error && /delivery_status/i.test(rows.error.message || '') && (view === 'delivered' || view === 'read')) {
      return NextResponse.json({ success: true, rows: [], total: 0, page });
    }
    if (rows.error) return NextResponse.json({ error: rows.error.message }, { status: 500 });
    return NextResponse.json({ success: true, rows: rows.data || [], total: rows.count || 0, page });
  }

  if (section === 'leads') {
    const filters = {
      q: params.get('q') || '',
      from: params.get('from') || '',
      to: params.get('to') || '',
      status: params.get('status') || '',
      city: params.get('city') || '',
      source: params.get('source') || '',
      crm: params.get('crm') || '',
    };
    const found = await collectLeadContacts(db, filters);
    if (found.error) return NextResponse.json({ error: found.error.message }, { status: 500 });
    return NextResponse.json({
      success: true,
      total: found.people.length,
      sample: found.people.slice(0, 8).map((person) => ({ name: person.name, phone: person.phone })),
    });
  }

  if (section === 'contacts') {
    const page = Math.max(1, Number(params.get('page') || 1));
    const limit = Math.min(100, Math.max(10, Number(params.get('limit') || 40)));
    const filters = {
      q: params.get('q') || '',
      from: params.get('from') || '',
      to: params.get('to') || '',
      uploadId: params.get('upload_id') || '',
    };
    const countQuery = applyContactFilters(db.from('wa_bulk_contacts').select('id', { count: 'exact', head: true }), filters);
    let list = await applyContactFilters(
      db.from('wa_bulk_contacts').select('id, phone, name, fields, created_at, upload_id').order('created_at', { ascending: false }),
      filters,
    ).range((page - 1) * limit, page * limit - 1);
    if (list.error && /fields/i.test(list.error.message || '')) {
      list = await applyContactFilters(
        db.from('wa_bulk_contacts').select('id, phone, name, created_at, upload_id').order('created_at', { ascending: false }),
        filters,
      ).range((page - 1) * limit, page * limit - 1);
    }
    const count = await countQuery;
    const error = list.error || count.error;
    if (error) {
      if (tablesMissing(error)) return missingResponse();
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      contacts: list.data || [],
      total: count.count || 0,
      page,
      limit,
    });
  }

  let campaignsQuery = db
    .from('wa_bulk_campaigns')
    .select('id, name, template_name, status, total, sent, failed, skipped, button_map, created_at, finished_at')
    .order('created_at', { ascending: false })
    .limit(30);
  const [totalRes, segmentsRes, uploadsRes, fieldsRes] = await Promise.all([
    db.from('wa_bulk_contacts').select('id', { count: 'exact', head: true }),
    db.from('wa_bulk_segments').select('id, name, description, condition_count, created_at').order('created_at', { ascending: false }),
    db.from('wa_bulk_uploads').select('id, label, added, created_at').order('created_at', { ascending: false }).limit(40),
    db.from('wa_bulk_custom_fields').select('id, field_key, title, description, field_type, created_at').order('created_at', { ascending: true }),
  ]);
  let campaignsRes = await campaignsQuery;
  if (campaignsRes.error && /button_map/i.test(campaignsRes.error.message || '')) {
    campaignsRes = await db
      .from('wa_bulk_campaigns')
      .select('id, name, template_name, status, total, sent, failed, skipped, created_at, finished_at')
      .order('created_at', { ascending: false })
      .limit(30);
  }
  let segmentRows = segmentsRes;
  if (segmentRows.error && /description|condition_count/i.test(segmentRows.error.message || '')) {
    segmentRows = await db.from('wa_bulk_segments').select('id, name, created_at').order('created_at', { ascending: false });
  }
  const firstError = totalRes.error || segmentRows.error || campaignsRes.error;
  if (firstError) {
    if (tablesMissing(firstError)) return missingResponse();
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const segments = await Promise.all(
    ((segmentRows.data || []) as Array<{ id: string; name: string; created_at: string; description?: string; condition_count?: number }>).map(async (segment) => {
      const count = await db
        .from('wa_bulk_segment_contacts')
        .select('contact_id', { count: 'exact', head: true })
        .eq('segment_id', segment.id);
      return { ...segment, contact_count: count.count || 0 };
    }),
  );

  const uploads = await Promise.all(
    ((uploadsRes.data || []) as Array<{ id: string; label: string; added: number; created_at: string }>).map(async (upload) => {
      const count = await db
        .from('wa_bulk_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('upload_id', upload.id);
      const contacts = count.count || 0;
      if (!count.error && contacts !== Number(upload.added || 0)) {
        await db.from('wa_bulk_uploads').update({ added: contacts }).eq('id', upload.id);
      }
      return { ...upload, added: count.error ? upload.added : contacts };
    }),
  );

  const accountState = await withAccountLimits(db, await listSendingAccounts(db));
  return NextResponse.json({
    success: true,
    sending_number: accountState.active?.display_phone || DEFAULT_SENDING_NUMBER,
    accounts: accountState.accounts,
    accounts_ready: accountState.ready,
    contact_total: totalRes.count || 0,
    segments,
    campaigns: (campaignsRes.data || []).map((row: any) => ({ ...row, button_map: row.button_map || [] })),
    uploads: uploadsRes.error ? [] : uploads,
    uploads_ready: !uploadsRes.error,
    custom_fields: fieldsRes.error ? [] : fieldsRes.data || [],
    custom_fields_ready: !fieldsRes.error,
  });
}

async function uploadCampaignImage(db: any, file: File, templateName: string) {
  if (!file || file.size <= 0) return NextResponse.json({ error: 'Choose an image first' }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Image must be under 5 MB' }, { status: 400 });
  const mime = String(file.type || '').toLowerCase();
  const allowed = mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp' || /\.(jpe?g|png|webp)$/i.test(file.name || '');
  if (!allowed) return NextResponse.json({ error: 'Use a JPG, PNG, or WEBP image' }, { status: 400 });
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Storage is not configured' }, { status: 500 });
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const filePath = `templates/campaign-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await supabaseAdmin.storage.from('whatsapp-media').upload(filePath, buffer, {
    contentType: mime.startsWith('image/') ? mime : `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    upsert: false,
  });
  if (uploaded.error) return NextResponse.json({ error: uploaded.error.message }, { status: 500 });
  const publicUrl = supabaseAdmin.storage.from('whatsapp-media').getPublicUrl(filePath).data.publicUrl;
  if (templateName) {
    const existing = await db.from('whatsapp_templates').select('meta').ilike('template_name', templateName).maybeSingle();
    const meta = existing.data?.meta && typeof existing.data.meta === 'object' ? existing.data.meta : {};
    await db.from('whatsapp_templates').update({
      meta: { ...meta, header_image_url: publicUrl },
      updated_at: new Date().toISOString(),
    }).ilike('template_name', templateName);
  }
  return NextResponse.json({ success: true, url: publicUrl });
}

export async function POST(request: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = auth.db;
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    return uploadCampaignImage(db, file instanceof File ? file : new File([], ''), String(form.get('template_name') || ''));
  }
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '');

  try {
    if (action === 'add_contacts') {
      const parsed = parseContactLines(String(body?.text || ''));
      const rows = parsed.rows;
      if (!rows.length) return NextResponse.json({ error: 'No valid mobile numbers found' }, { status: 400 });
      let label = String(body?.upload_label || '').trim().slice(0, 80) || `Upload ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
      let uploadId = String(body?.upload_id || '').trim();
      if (uploadId) {
        const current = await db.from('wa_bulk_uploads').select('id, label, added').eq('id', uploadId).maybeSingle();
        if (current.data?.id) {
          label = String(current.data.label || label);
          await db.from('wa_bulk_uploads').update({ added: Number(current.data.added || 0) + rows.length }).eq('id', uploadId);
        } else {
          uploadId = '';
        }
      }
      if (!uploadId) {
        const upload = await db.from('wa_bulk_uploads').insert({ label, added: rows.length }).select('id, label').maybeSingle();
        if (!upload.error && upload.data?.id) uploadId = upload.data.id;
      }

      let fieldsSaved = true;
      for (let index = 0; index < rows.length; index += 400) {
        const slice = rows.slice(index, index + 400).map((row) => ({
          phone: row.phone,
          name: row.name || null,
          fields: row.fields || {},
          ...(uploadId ? { upload_id: uploadId } : {}),
        }));
        let payload = slice.map((row) => ({ ...row }));
        let saved = await db.from('wa_bulk_contacts').upsert(payload, { onConflict: 'phone' });
        if (saved.error && /fields/i.test(saved.error.message || '')) {
          fieldsSaved = false;
          payload = payload.map(({ phone, name, upload_id }) => ({ phone, name, ...(upload_id ? { upload_id } : {}) }));
          saved = await db.from('wa_bulk_contacts').upsert(payload, { onConflict: 'phone' });
        }
        if (saved.error && /upload_id/i.test(saved.error.message || '')) {
          saved = await db.from('wa_bulk_contacts').upsert(
            payload.map(({ phone, name, fields }) => ({ phone, name, ...(fields ? { fields } : {}) })),
            { onConflict: 'phone' },
          );
        }
        if (saved.error) {
          if (tablesMissing(saved.error)) return missingResponse();
          return NextResponse.json({ error: saved.error.message }, { status: 500 });
        }
      }

      const segmentId = String(body?.segment_id || '').trim();
      if (segmentId) {
        const found = await selectIn(db, 'wa_bulk_contacts', 'id, phone', 'phone', rows.map((row) => row.phone));
        if (found.error) return NextResponse.json({ error: found.error.message }, { status: 500 });
        const links = (found.data || []).map((row: { id: string }) => ({ segment_id: segmentId, contact_id: row.id }));
        for (let index = 0; index < links.length; index += 400) {
          const linked = await db
            .from('wa_bulk_segment_contacts')
            .upsert(links.slice(index, index + 400), { onConflict: 'segment_id,contact_id', ignoreDuplicates: true });
          if (linked.error) return NextResponse.json({ error: linked.error.message }, { status: 500 });
        }
      }

      let fieldsCreated = 0;
      let customFieldsReady = true;
      if (parsed.fieldDefs.length) {
        const savedDefs = await db.from('wa_bulk_custom_fields').upsert(
          parsed.fieldDefs.map((field) => ({
            field_key: field.key,
            title: field.title,
            field_type: field.field_type,
            description: 'From contact upload',
          })),
          { onConflict: 'field_key', ignoreDuplicates: true },
        );
        if (savedDefs.error && /does not exist|relation|42P01|PGRST205/i.test(savedDefs.error.message || '')) {
          customFieldsReady = false;
        } else if (!savedDefs.error) {
          fieldsCreated = parsed.fieldDefs.length;
        }
      }

      return NextResponse.json({
        success: true,
        added: rows.length,
        upload_id: uploadId || null,
        upload_label: label,
        fields_saved: fieldsSaved,
        fields_created: fieldsCreated,
        field_titles: parsed.fieldDefs.map((field) => field.title),
        custom_fields_ready: customFieldsReady,
      });
    }

    if (action === 'segment_from_filter') {
      const name = String(body?.name || '').trim().slice(0, 80);
      if (!name) return NextResponse.json({ error: 'Segment name is required' }, { status: 400 });
      const filtered = await listFilteredContactIds(db, {
        q: String(body?.q || ''),
        from: String(body?.from || ''),
        to: String(body?.to || ''),
        uploadId: String(body?.upload_id || ''),
      });
      if (filtered.error) {
        if (tablesMissing(filtered.error)) return missingResponse();
        return NextResponse.json({ error: filtered.error.message }, { status: 500 });
      }
      if (!filtered.ids.length) return NextResponse.json({ error: 'No contacts match this filter' }, { status: 400 });
      const conditions = [body?.q, body?.from, body?.to, body?.upload_id].filter((value) => String(value || '').trim()).length || 1;
      const saved = await writeSegment(db, { name, description: String(body?.description || name), condition_count: conditions });
      if (saved.error || !saved.data) return NextResponse.json({ error: saved.error?.message || 'Could not create segment' }, { status: 500 });
      for (let index = 0; index < filtered.ids.length; index += 400) {
        const links = filtered.ids.slice(index, index + 400).map((contactId) => ({
          segment_id: saved.data.id,
          contact_id: contactId,
        }));
        const linked = await db.from('wa_bulk_segment_contacts').upsert(links, { onConflict: 'segment_id,contact_id', ignoreDuplicates: true });
        if (linked.error) return NextResponse.json({ error: linked.error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, segment: saved.data, contact_count: filtered.ids.length });
    }

    if (action === 'segment_from_leads') {
      const name = String(body?.name || '').trim().slice(0, 80);
      if (!name) return NextResponse.json({ error: 'Segment name is required' }, { status: 400 });
      const filters = {
        q: String(body?.q || ''),
        from: String(body?.from || ''),
        to: String(body?.to || ''),
        status: String(body?.status || ''),
        city: String(body?.city || ''),
        source: String(body?.source || ''),
        crm: String(body?.crm || ''),
      };
      const found = await collectLeadContacts(db, filters);
      if (found.error) return NextResponse.json({ error: found.error.message }, { status: 500 });
      if (!found.people.length) return NextResponse.json({ error: 'No leads with a valid mobile match this filter' }, { status: 400 });

      for (let index = 0; index < found.people.length; index += 400) {
        const slice = found.people.slice(index, index + 400).map((person) => ({
          phone: person.phone,
          name: person.name || null,
        }));
        const saved = await db.from('wa_bulk_contacts').upsert(slice, { onConflict: 'phone', ignoreDuplicates: true });
        if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 });
      }
      const ids = await selectIn(db, 'wa_bulk_contacts', 'id', 'phone', found.people.map((person) => person.phone));
      if (ids.error) return NextResponse.json({ error: ids.error.message }, { status: 500 });
      const conditions = [filters.q, filters.from, filters.to, filters.city, filters.source, filters.status && filters.status !== 'ALL' ? filters.status : '', filters.crm && filters.crm !== 'ALL' ? filters.crm : ''].filter((value) => String(value || '').trim()).length || 1;
      const segment = await writeSegment(db, { name, description: String(body?.description || name), condition_count: conditions });
      if (segment.error || !segment.data) return NextResponse.json({ error: segment.error?.message || 'Could not create segment' }, { status: 500 });
      const contactIds = (ids.data || []).map((row: { id: string }) => row.id);
      for (let index = 0; index < contactIds.length; index += 400) {
        const links = contactIds.slice(index, index + 400).map((contactId: string) => ({ segment_id: segment.data.id, contact_id: contactId }));
        const linked = await db.from('wa_bulk_segment_contacts').upsert(links, { onConflict: 'segment_id,contact_id', ignoreDuplicates: true });
        if (linked.error) return NextResponse.json({ error: linked.error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, segment: segment.data, contact_count: contactIds.length });
    }

    if (action === 'test_send') {
      return testSend(db, auth.userId, auth.actorName, auth.role, body);
    }

    if (action === 'connect_account') return connectAccount(db, body);
    if (action === 'sync_account_templates') return syncAccountTemplates(db, auth.userId, body);
    if (action === 'activate_account') return activateAccount(db, body);
    if (action === 'delete_account') return deleteAccount(db, body);

    if (action === 'save_field') {
      const title = String(body?.title || '').trim().slice(0, 80);
      if (!title) return NextResponse.json({ error: 'Field title is required' }, { status: 400 });
      const key = fieldKey(title);
      if (!key) return NextResponse.json({ error: 'Field title needs letters or numbers' }, { status: 400 });
      const fieldType = String(body?.field_type || 'STRING').toUpperCase() === 'NUMBER' ? 'NUMBER' : 'STRING';
      const saved = await db.from('wa_bulk_custom_fields').upsert({
        field_key: key,
        title,
        description: String(body?.description || '').trim().slice(0, 180),
        field_type: fieldType,
      }, { onConflict: 'field_key' }).select('id, field_key, title, description, field_type, created_at').maybeSingle();
      if (saved.error) {
        if (/does not exist|relation|42P01|PGRST205/i.test(saved.error.message || '')) {
          return NextResponse.json({ error: 'Run database/392_whatsapp_bulk_custom_fields.sql in Supabase, then add the field again.' }, { status: 503 });
        }
        return NextResponse.json({ error: saved.error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, field: saved.data });
    }

    if (action === 'delete_field') {
      const id = String(body?.id || '').trim();
      if (!id) return NextResponse.json({ error: 'Field id is required' }, { status: 400 });
      const removed = await db.from('wa_bulk_custom_fields').delete().eq('id', id);
      if (removed.error) return NextResponse.json({ error: removed.error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_contact') {
      const id = String(body?.id || '').trim();
      if (!id) return NextResponse.json({ error: 'Contact id is required' }, { status: 400 });
      const deleted = await db.from('wa_bulk_contacts').delete().eq('id', id);
      if (deleted.error) {
        if (tablesMissing(deleted.error)) return missingResponse();
        return NextResponse.json({ error: deleted.error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'save_segment') {
      const name = String(body?.name || '').trim().slice(0, 80);
      if (!name) return NextResponse.json({ error: 'Segment name is required' }, { status: 400 });
      const id = String(body?.id || '').trim();
      const saved = await writeSegment(db, {
        name,
        description: String(body?.description || name),
        condition_count: Number(body?.condition_count ?? 1),
      }, id);
      if (saved.error) {
        if (tablesMissing(saved.error)) return missingResponse();
        return NextResponse.json({ error: saved.error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, segment: saved.data });
    }

    if (action === 'delete_upload') {
      const id = String(body?.id || '').trim();
      if (!id) return NextResponse.json({ error: 'Upload id is required' }, { status: 400 });
      for (;;) {
        const page = await db.from('wa_bulk_contacts').select('id').eq('upload_id', id).limit(500);
        if (page.error) return NextResponse.json({ error: page.error.message }, { status: 500 });
        const ids = (page.data || []).map((row: { id: string }) => row.id);
        if (!ids.length) break;
        const removed = await db.from('wa_bulk_contacts').delete().in('id', ids);
        if (removed.error) return NextResponse.json({ error: removed.error.message }, { status: 500 });
      }
      const deleted = await db.from('wa_bulk_uploads').delete().eq('id', id);
      if (deleted.error) return NextResponse.json({ error: deleted.error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_segment') {
      const id = String(body?.id || '').trim();
      if (!id) return NextResponse.json({ error: 'Segment id is required' }, { status: 400 });
      const deleted = await db.from('wa_bulk_segments').delete().eq('id', id);
      if (deleted.error) return NextResponse.json({ error: deleted.error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'add_members' || action === 'remove_members') {
      const segmentId = String(body?.segment_id || '').trim();
      const contactIds = Array.isArray(body?.contact_ids)
        ? body.contact_ids.map((id: unknown) => String(id || '').trim()).filter(Boolean).slice(0, 2000)
        : [];
      if (!segmentId || !contactIds.length) {
        return NextResponse.json({ error: 'Segment and contacts are required' }, { status: 400 });
      }
      if (action === 'add_members') {
        const links = contactIds.map((contactId: string) => ({ segment_id: segmentId, contact_id: contactId }));
        const saved = await db.from('wa_bulk_segment_contacts').upsert(links, { onConflict: 'segment_id,contact_id', ignoreDuplicates: true });
        if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 });
      } else {
        const removed = await db.from('wa_bulk_segment_contacts').delete().eq('segment_id', segmentId).in('contact_id', contactIds);
        if (removed.error) return NextResponse.json({ error: removed.error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'save_campaign') return saveCampaign(db, auth.userId, body);
    if (action === 'send_start') return startCampaign(db, auth.userId, body);
    if (action === 'send_batch') return sendBatch(db, auth.userId, auth.actorName, auth.role, body);
    if (action === 'stop_campaign') return stopCampaign(db, body);

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Bulk WhatsApp request failed' }, { status: 500 });
  }
}

async function testSend(db: any, userId: string, actorName: string, role: string, body: any) {
  const phone = toPhone(String(body?.phone || ''));
  if (!phone) return NextResponse.json({ error: 'Enter a valid 10-digit test number' }, { status: 400 });
  const templateName = String(body?.template_name || '').trim();
  const params = Array.isArray(body?.params) ? body.params.map((value: unknown) => String(value ?? '')) : [];
  if (!templateName) return NextResponse.json({ error: 'Choose a template first' }, { status: 400 });

  const template = await db
    .from('whatsapp_templates')
    .select('template_name, language_code, category, is_active, meta')
    .ilike('template_name', templateName)
    .maybeSingle();
  if (template.error) return NextResponse.json({ error: template.error.message }, { status: 500 });
  const row = template.data;
  if (!row) return NextResponse.json({ error: 'Template not found' }, { status: 400 });
  const metaStatus = String(row.meta?.status || '').toUpperCase();
  if (metaStatus && metaStatus !== 'APPROVED') {
    return NextResponse.json({ error: `Template is ${metaStatus}. Test send needs an approved template.` }, { status: 400 });
  }

  const savedContact = await db.from('wa_bulk_contacts').select('name, fields').eq('phone', phone).maybeSingle();
  const savedFields = savedContact.data?.fields && typeof savedContact.data.fields === 'object' ? savedContact.data.fields : {};
  const headerImageUrl = chosenHeaderImage(body, row.meta);
  if (templateNeedsImage(row.meta) && !headerImageUrl) {
    return NextResponse.json({ error: 'This template needs a header image. Upload one before sending.' }, { status: 400 });
  }
  const filled = fillParams(params, String(body?.name || savedContact.data?.name || 'Test'), savedFields);
  const sender = await loadActiveSender(db);
  const result = await sendTemplateMessage({
    phoneNumber: phone,
    templateName: String(row.meta?.send_name || row.template_name),
    templateParams: filled,
    languageCode: row.language_code || 'en',
    headerImageUrl,
    sender,
  });
  const now = new Date().toISOString();
  await db.from('whatsapp_messages').insert({
    provider_message_id: result.messageId || null,
    direction: 'OUTBOUND',
    message_type: 'TEMPLATE',
    recipient_phone: phone,
    template_name: row.template_name,
    template_language: row.language_code || 'en',
    text_body: `Test: ${row.template_name}`,
    status: result.success ? 'SENT' : 'FAILED',
    status_at: now,
    error_message: result.success ? null : result.error || 'Send failed',
    payload: { source: 'bulk_test', response: result.raw || null },
    meta: { source: 'bulk_test', actor_id: userId, actor_name: actorName, role_code: role, phone_number_id: sender?.phoneNumberId || null },
    created_by: userId,
    updated_at: now,
  });
  if (!result.success) return NextResponse.json({ error: result.error || 'Test send failed' }, { status: 502 });
  if (result.messageId) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const check = await db
        .from('whatsapp_messages')
        .select('status, error_message')
        .eq('provider_message_id', result.messageId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const delivery = String(check.data?.status || '').toUpperCase();
      if (delivery === 'FAILED') {
        return NextResponse.json({ error: check.data?.error_message || 'WhatsApp rejected this message.' }, { status: 502 });
      }
      if (delivery === 'DELIVERED' || delivery === 'VIEWED' || delivery === 'READ') break;
    }
  }
  return NextResponse.json({ success: true, message_id: result.messageId || null });
}

async function graphGet(apiUrl: string, accessToken: string, path: string) {
  const response = await fetch(`${apiUrl}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, json };
}

async function idHasTemplates(apiUrl: string, accessToken: string, id: string) {
  const result = await graphGet(apiUrl, accessToken, `${id}/message_templates?fields=id&limit=1`);
  if (result.ok) return true;
  return !/nonexisting field|message_templates/i.test(String(result.json?.error?.message || ''));
}

async function wabaOwnsPhone(apiUrl: string, accessToken: string, wabaId: string, phoneNumberId: string) {
  const result = await graphGet(apiUrl, accessToken, `${wabaId}/phone_numbers?fields=id&limit=50`);
  return (result.json?.data || []).some((row: { id?: string }) => String(row.id) === phoneNumberId);
}

async function wabasUnderBusiness(apiUrl: string, accessToken: string, businessId: string) {
  const ids: string[] = [];
  for (const edge of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']) {
    const result = await graphGet(apiUrl, accessToken, `${businessId}/${edge}?fields=id&limit=20`);
    for (const row of result.json?.data || []) ids.push(String(row.id || ''));
  }
  return Array.from(new Set(ids.filter(Boolean)));
}

async function resolveWabaForTemplates(apiUrl: string, accessToken: string, phoneNumberId: string, candidateId: string) {
  const nested = candidateId ? await wabasUnderBusiness(apiUrl, accessToken, candidateId) : [];
  const pool = Array.from(new Set([candidateId, ...nested].filter(Boolean)));
  for (const id of pool) {
    if (!(await idHasTemplates(apiUrl, accessToken, id))) continue;
    if (await wabaOwnsPhone(apiUrl, accessToken, id, phoneNumberId)) return id;
  }
  const usable = [];
  for (const id of nested) {
    if (await idHasTemplates(apiUrl, accessToken, id)) usable.push(id);
  }
  if (usable.length === 1) return usable[0];
  return discoverWabaId(apiUrl, accessToken, phoneNumberId, '');
}

async function discoverWabaId(apiUrl: string, accessToken: string, phoneNumberId: string, savedWabaId: string) {
  if (savedWabaId) return savedWabaId;
  const debug = await fetch(`${apiUrl}/debug_token?input_token=${encodeURIComponent(accessToken)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await debug.json().catch(() => ({}));
  const appId = String(payload?.data?.app_id || '');
  const appSecret = String(process.env.WHATSAPP_APP_SECRET || '');
  let scopes = Array.isArray(payload?.data?.granular_scopes) ? payload.data.granular_scopes : [];
  if (appId && appSecret && !scopes.some((scope: { target_ids?: string[] }) => scope?.target_ids?.length)) {
    const appToken = `${appId}|${appSecret}`;
    const again = await fetch(`${apiUrl}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`);
    const againPayload = await again.json().catch(() => ({}));
    if (Array.isArray(againPayload?.data?.granular_scopes)) scopes = againPayload.data.granular_scopes;
  }
  const ids = Array.from(new Set(scopes.flatMap((scope: { target_ids?: string[] }) => scope?.target_ids || [])));
  for (const id of ids) {
    const phones = await fetch(`${apiUrl}/${id}/phone_numbers?fields=id&limit=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await phones.json().catch(() => ({}));
    if ((json.data || []).some((row: { id?: string }) => String(row.id) === phoneNumberId)) return String(id);
  }
  return String(ids[0] || '');
}

async function syncAccountTemplates(db: any, userId: string, body: any) {
  const id = String(body?.id || '').trim();
  if (!id || id === 'settings') {
    return NextResponse.json({ error: 'Open WhatsApp Templates and use Sync for the settings number.' }, { status: 400 });
  }
  const account = await db.from('wa_bulk_accounts').select('id, label, display_phone, phone_number_id, waba_id, access_token, api_url').eq('id', id).maybeSingle();
  if (account.error || !account.data) return NextResponse.json({ error: account.error?.message || 'Account not found' }, { status: 404 });
  const apiUrl = String(account.data.api_url || 'https://graph.facebook.com/v25.0').replace(/\/$/, '');
  const accessToken = String(account.data.access_token || '');
  const phoneNumberId = String(account.data.phone_number_id || '');
  const accountPhone = String(account.data.display_phone || '').replace(/\D/g, '').slice(-10);
  const providedWabaId = String(body?.waba_id || account.data.waba_id || '').replace(/\D/g, '');
  const wabaId = await resolveWabaForTemplates(apiUrl, accessToken, phoneNumberId, providedWabaId);
  if (!wabaId) {
    return NextResponse.json({ error: 'That number is the Business ID. In the WhatsApp Manager link, paste the asset_id. For this account it is 403294406199168.' }, { status: 400 });
  }
  if (account.data.waba_id !== wabaId) await db.from('wa_bulk_accounts').update({ waba_id: wabaId }).eq('id', id);

  const templates: any[] = [];
  let nextUrl = `${apiUrl}/${wabaId}/message_templates?fields=id,name,language,status,category,components&limit=100`;
  while (nextUrl) {
    const response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: payload?.error?.error_user_msg || payload?.error?.message || 'Could not read templates from this account.' }, { status: 502 });
    }
    templates.push(...(Array.isArray(payload.data) ? payload.data : []));
    nextUrl = payload?.paging?.next || '';
  }

  const existing = await db.from('whatsapp_templates').select('template_name, meta');
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
  const byName = new Map<string, any>((existing.data || []).map((row: { template_name: string; meta?: any }) => [String(row.template_name).toLowerCase(), row.meta || {}]));
  const rows = templates.map((template) => {
    const metaName = String(template.name || '').trim().toLowerCase();
    if (!metaName) return null;
    const body = (template.components || []).find((item: { type?: string }) => String(item.type || '').toUpperCase() === 'BODY');
    const bodyText = String(body?.text || '').trim() || '[Body not provided by Meta]';
    const prior = byName.get(metaName) || {};
    const priorPhone = String(prior.account_phone || '').replace(/\D/g, '').slice(-10);
    const takenByOther = byName.has(metaName) && priorPhone !== accountPhone;
    const localName = takenByOther ? `${metaName}__${accountPhone.slice(-5)}` : metaName;
    const priorLocal = byName.get(localName) || {};
    return {
      template_name: localName,
      display_name: String(template.name || metaName),
      language_code: String(template.language || 'en'),
      category: String(template.category || 'UTILITY').toUpperCase(),
      body_text: bodyText,
      variable_keys: Array.from(bodyText.matchAll(/\{\{\s*(\d+)\s*\}\}/g)).map((match) => `variable_${match[1]}`),
      example_values: Array.isArray(body?.example?.body_text?.[0]) ? body.example.body_text[0] : [],
      is_active: String(template.status || '').toUpperCase() === 'APPROVED',
      meta: {
        ...(priorLocal.header_image_url ? { header_image_url: priorLocal.header_image_url } : {}),
        source: 'meta_sync',
        status: String(template.status || '').toUpperCase(),
        template_id: template.id || null,
        send_name: metaName,
        account_phone: accountPhone,
        waba_id: wabaId,
        synced_at: new Date().toISOString(),
        raw: template,
      },
      created_by: userId,
      updated_at: new Date().toISOString(),
    };
  }).filter(Boolean);

  for (let index = 0; index < rows.length; index += 50) {
    const saved = await db.from('whatsapp_templates').upsert(rows.slice(index, index + 50), { onConflict: 'template_name' });
    if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, synced: rows.length, display_phone: account.data.display_phone, waba_id: wabaId });
}

async function connectAccount(db: any, body: any) {
  const rawId = String(body?.phone_number_id || '').trim();
  const phoneNumberId = rawId.replace(/\D/g, '');
  const wabaId = String(body?.waba_id || '').replace(/\D/g, '');
  const label = String(body?.label || '').trim().slice(0, 80);
  if (!/^\d{13,20}$/.test(phoneNumberId)) {
    return NextResponse.json({ error: 'Phone number ID is the long number in WhatsApp Manager → Phone numbers. It is not the mobile number and not an email.' }, { status: 400 });
  }
  let accessToken = String(body?.access_token || '').trim();
  if (!accessToken) {
    const creds = await getResolvedWhatsAppAgentsCredentials();
    accessToken = String(creds.whatsapp_access_token || '').trim();
  }
  if (!accessToken) {
    return NextResponse.json({ error: 'No access token is saved in WhatsApp Settings.' }, { status: 400 });
  }
  const apiUrl = 'https://graph.facebook.com/v25.0';
  const infoRes = await fetch(`${apiUrl}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,status`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const info = await infoRes.json().catch(() => ({}));
  if (!infoRes.ok) {
    const raw = String(info?.error?.error_user_msg || info?.error?.message || '');
    const blocked = /does not exist|missing permissions|unsupported get request/i.test(raw);
    const message = blocked
      ? 'This Phone number ID is not on the WhatsApp account saved in Settings. In WhatsApp Manager open this number, copy the Phone number ID from its row, and paste that account’s access token below.'
      : (raw || 'WhatsApp did not accept this number.');
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const payload = {
    label: label || String(info.verified_name || 'WhatsApp'),
    display_phone: prettyIndianPhone(String(info.display_phone_number || '')),
    verified_name: String(info.verified_name || ''),
    phone_number_id: phoneNumberId,
    waba_id: wabaId,
    access_token: accessToken,
    api_url: apiUrl,
    quality_rating: String(info.quality_rating || ''),
    is_active: true,
  };
  const existing = await db.from('wa_bulk_accounts').select('id').eq('phone_number_id', phoneNumberId).maybeSingle();
  if (existing.error) {
    if (tablesMissing(existing.error) || /wa_bulk_accounts/i.test(existing.error.message || '')) {
      return NextResponse.json({ error: 'Run database/394_whatsapp_bulk_accounts.sql in Supabase, then connect the number again.' }, { status: 503 });
    }
    return NextResponse.json({ error: existing.error.message }, { status: 500 });
  }
  const saved = existing.data
    ? await db.from('wa_bulk_accounts').update(payload).eq('id', existing.data.id).select('id, label, display_phone, verified_name, phone_number_id, quality_rating, is_active').maybeSingle()
    : await db.from('wa_bulk_accounts').insert(payload).select('id, label, display_phone, verified_name, phone_number_id, quality_rating, is_active').maybeSingle();
  if (saved.error || !saved.data) return NextResponse.json({ error: saved.error?.message || 'Could not save this account' }, { status: 500 });
  await db.from('wa_bulk_accounts').update({ is_active: false }).neq('id', saved.data.id);
  return NextResponse.json({ success: true, account: publicAccount(saved.data, true) });
}

async function activateAccount(db: any, body: any) {
  const id = String(body?.id || '').trim();
  if (!id || id === 'settings') {
    const cleared = await db.from('wa_bulk_accounts').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (cleared.error && !(tablesMissing(cleared.error))) return NextResponse.json({ error: cleared.error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: 'settings' });
  }
  const found = await db.from('wa_bulk_accounts').select('id').eq('id', id).maybeSingle();
  if (found.error) {
    if (tablesMissing(found.error)) {
      return NextResponse.json({ error: 'Run database/394_whatsapp_bulk_accounts.sql in Supabase first.' }, { status: 503 });
    }
    return NextResponse.json({ error: found.error.message }, { status: 500 });
  }
  if (!found.data) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  await db.from('wa_bulk_accounts').update({ is_active: false }).neq('id', id);
  const updated = await db.from('wa_bulk_accounts').update({ is_active: true }).eq('id', id);
  if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 500 });
  return NextResponse.json({ success: true, id });
}

async function deleteAccount(db: any, body: any) {
  const id = String(body?.id || '').trim();
  if (!id || id === 'settings') return NextResponse.json({ error: 'The settings number stays connected.' }, { status: 400 });
  const removed = await db.from('wa_bulk_accounts').delete().eq('id', id);
  if (removed.error) return NextResponse.json({ error: removed.error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

function campaignButtonMap(body: any) {
  return Array.isArray(body?.button_map)
    ? body.button_map
        .map((item: any) => ({
          text: String(item?.text || '').trim().slice(0, 40),
          action: item?.action === 'create_lead' ? 'create_lead' : 'ignore',
          tag: String(item?.tag || item?.text || '').trim().slice(0, 40),
        }))
        .filter((item: { text: string }) => item.text)
    : [];
}

async function saveCampaign(db: any, userId: string, body: any) {
  const segmentId = String(body?.segment_id || '').trim();
  const templateName = String(body?.template_name || '').trim();
  const params = Array.isArray(body?.params) ? body.params.map((value: unknown) => String(value ?? '')) : [];
  if (!segmentId || !templateName) {
    return NextResponse.json({ error: 'Segment and template are required' }, { status: 400 });
  }

  const template = await db
    .from('whatsapp_templates')
    .select('template_name, language_code')
    .ilike('template_name', templateName)
    .maybeSingle();
  if (template.error) return NextResponse.json({ error: template.error.message }, { status: 500 });
  if (!template.data) return NextResponse.json({ error: 'Template not found. Sync templates first.' }, { status: 400 });

  const members = await loadSegmentContactIds(db, segmentId);
  if (members.error) {
    if (tablesMissing(members.error)) return missingResponse();
    return NextResponse.json({ error: members.error.message }, { status: 500 });
  }

  const payload = {
    name: String(body?.name || '').trim().slice(0, 80) || template.data.template_name,
    segment_id: segmentId,
    template_name: template.data.template_name,
    language_code: template.data.language_code || 'en',
    body_params: params,
    button_map: campaignButtonMap(body),
    status: 'draft',
    total: members.ids.length,
  };

  const existingId = String(body?.campaign_id || '').trim();
  if (existingId) {
    const current = await db.from('wa_bulk_campaigns').select('id, status').eq('id', existingId).maybeSingle();
    if (current.error) return NextResponse.json({ error: current.error.message }, { status: 500 });
    if (current.data?.status === 'draft') {
      const updated = await db.from('wa_bulk_campaigns').update(payload).eq('id', existingId).select('id, name, status, total').maybeSingle();
      if (updated.error || !updated.data) return NextResponse.json({ error: updated.error?.message || 'Could not save campaign' }, { status: 500 });
      return NextResponse.json({ success: true, campaign: updated.data });
    }
  }

  const created = await db
    .from('wa_bulk_campaigns')
    .insert({ ...payload, created_by: userId })
    .select('id, name, status, total')
    .maybeSingle();
  if (created.error || !created.data) {
    return NextResponse.json({ error: created.error?.message || 'Could not save campaign' }, { status: 500 });
  }
  return NextResponse.json({ success: true, campaign: created.data });
}

async function startCampaign(db: any, userId: string, body: any) {
  const existingId = String(body?.campaign_id || '').trim();
  let existing: any = null;
  if (existingId) {
    const loaded = await db
      .from('wa_bulk_campaigns')
      .select('id, status, segment_id, template_name, name, body_params, button_map')
      .eq('id', existingId)
      .maybeSingle();
    if (loaded.error) return NextResponse.json({ error: loaded.error.message }, { status: 500 });
    if (!loaded.data) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    existing = loaded.data;
    if (existing.status === 'completed' || existing.status === 'stopped') {
      return NextResponse.json({ error: 'This campaign has already finished.' }, { status: 400 });
    }
    if (existing.status === 'sending') {
      const pending = await db.from('wa_bulk_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', existingId).eq('status', 'pending');
      return NextResponse.json({ success: true, campaign: existing, pending: pending.count || 0 });
    }
  }

  const segmentId = String(body?.segment_id || existing?.segment_id || '').trim();
  const templateName = String(body?.template_name || existing?.template_name || '').trim();
  const params = Array.isArray(body?.params)
    ? body.params.map((value: unknown) => String(value ?? ''))
    : (Array.isArray(existing?.body_params) ? existing.body_params.map((value: unknown) => String(value ?? '')) : []);
  if (!segmentId || !templateName) {
    return NextResponse.json({ error: 'Segment and template are required' }, { status: 400 });
  }

  const template = await db
    .from('whatsapp_templates')
    .select('template_name, language_code, category, is_active, meta')
    .ilike('template_name', templateName)
    .maybeSingle();
  if (template.error) return NextResponse.json({ error: template.error.message }, { status: 500 });
  const row = template.data;
  if (!row) return NextResponse.json({ error: 'Template not found. Sync templates first.' }, { status: 400 });

  const category = String(row.category || '').toUpperCase();
  const name = String(row.template_name || '').toLowerCase();
  if (category.includes('AUTH') || name.includes('otp') || name.startsWith('auth_')) {
    return NextResponse.json({ error: 'OTP / authentication templates cannot be sent in bulk' }, { status: 400 });
  }
  const metaStatus = String(row.meta?.status || '').toUpperCase();
  if (metaStatus && metaStatus !== 'APPROVED') {
    return NextResponse.json({ error: `Template is ${metaStatus}. Only approved templates can be sent.` }, { status: 400 });
  }
  if (!metaStatus && row.is_active === false) {
    return NextResponse.json({ error: 'Template is not active' }, { status: 400 });
  }

  const members = await loadSegmentContactIds(db, segmentId);
  if (members.error) {
    if (tablesMissing(members.error)) return missingResponse();
    return NextResponse.json({ error: members.error.message }, { status: 500 });
  }
  const contactIds = members.ids;
  if (!contactIds.length) return NextResponse.json({ error: 'This segment has no contacts' }, { status: 400 });

  const contacts = await selectIn(db, 'wa_bulk_contacts', 'id, phone, name', 'id', contactIds);
  if (contacts.error) return NextResponse.json({ error: contacts.error.message }, { status: 500 });
  const people = (contacts.data || []) as Array<{ id: string; phone: string; name: string | null }>;

  const last10s = Array.from(new Set(people.map((person) => person.phone.slice(-10))));
  const dnd = await selectIn(db, 'whatsapp_dnd_numbers', 'phone_last10', 'phone_last10', last10s);
  const blocked = new Set<string>(
    dnd.error ? [] : (dnd.data || []).map((item: { phone_last10: string }) => String(item.phone_last10)),
  );

  const campaignName = String(body?.name || existing?.name || '').trim().slice(0, 80) || templateName;
  const buttonMap = Array.isArray(body?.button_map) ? campaignButtonMap(body) : (Array.isArray(existing?.button_map) ? existing.button_map : []);
  const campaignRow = {
    name: campaignName,
    segment_id: segmentId,
    template_name: row.template_name,
    language_code: row.language_code || 'en',
    body_params: params,
    button_map: buttonMap,
    status: 'sending',
    total: people.length,
    skipped: people.filter((person) => blocked.has(person.phone.slice(-10))).length,
  };
  let created = existing
    ? await db.from('wa_bulk_campaigns').update(campaignRow).eq('id', existing.id).select('id, template_name, language_code, body_params, total, skipped').maybeSingle()
    : await db.from('wa_bulk_campaigns').insert({ ...campaignRow, created_by: userId }).select('id, template_name, language_code, body_params, total, skipped').maybeSingle();
  if (created.error && /button_map/i.test(created.error.message || '')) {
    const { button_map: _ignored, ...withoutMap } = campaignRow;
    created = existing
      ? await db.from('wa_bulk_campaigns').update(withoutMap).eq('id', existing.id).select('id, template_name, language_code, body_params, total, skipped').maybeSingle()
      : await db.from('wa_bulk_campaigns').insert({ ...withoutMap, created_by: userId }).select('id, template_name, language_code, body_params, total, skipped').maybeSingle();
  }
  if (created.error || !created.data) {
    return NextResponse.json({ error: created.error?.message || 'Could not start campaign' }, { status: 500 });
  }

  if (existing) {
    const cleared = await db.from('wa_bulk_recipients').delete().eq('campaign_id', created.data.id);
    if (cleared.error) return NextResponse.json({ error: cleared.error.message }, { status: 500 });
  }

  const recipients = people.map((person) => {
    const skip = blocked.has(person.phone.slice(-10));
    return {
      campaign_id: created.data.id,
      phone: person.phone,
      name: person.name,
      status: skip ? 'skipped' : 'pending',
      error: skip ? 'Do not disturb' : null,
    };
  });

  for (let index = 0; index < recipients.length; index += 500) {
    const inserted = await db.from('wa_bulk_recipients').insert(recipients.slice(index, index + 500));
    if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    campaign: created.data,
    pending: recipients.filter((row) => row.status === 'pending').length,
  });
}

async function sendBatch(db: any, userId: string, actorName: string, role: string, body: any) {
  const campaignId = String(body?.campaign_id || '').trim();
  if (!campaignId) return NextResponse.json({ error: 'Campaign id is required' }, { status: 400 });

  const campaign = await db
    .from('wa_bulk_campaigns')
    .select('id, template_name, language_code, body_params, status')
    .eq('id', campaignId)
    .maybeSingle();
  if (campaign.error) return NextResponse.json({ error: campaign.error.message }, { status: 500 });
  if (!campaign.data) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (campaign.data.status === 'draft') {
    return NextResponse.json({ error: 'This campaign is saved. Use Launch campaign to start sending.' }, { status: 400 });
  }
  if (campaign.data.status === 'completed' || campaign.data.status === 'stopped') {
    return NextResponse.json({
      success: true,
      done: true,
      stopped: campaign.data.status === 'stopped',
      sent_now: 0,
      failed_now: 0,
      pending: 0,
    });
  }

  const templateRow = await db
    .from('whatsapp_templates')
    .select('meta')
    .ilike('template_name', campaign.data.template_name)
    .maybeSingle();
  const headerImageUrl = chosenHeaderImage(body, templateRow.data?.meta);
  if (templateNeedsImage(templateRow.data?.meta) && !headerImageUrl) {
    return NextResponse.json({ error: 'This template needs a header image. Upload one before sending.' }, { status: 400 });
  }

  const pending = await db
    .from('wa_bulk_recipients')
    .select('id, phone, name')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .limit(BATCH_SIZE);
  if (pending.error) return NextResponse.json({ error: pending.error.message }, { status: 500 });

  const rows = (pending.data || []) as Array<{ id: string; phone: string; name: string | null }>;
  const params = Array.isArray(campaign.data.body_params) ? campaign.data.body_params.map((value: unknown) => String(value ?? '')) : [];
  const fieldLookup = await db.from('wa_bulk_contacts').select('phone, fields').in('phone', rows.map((row) => row.phone));
  const fieldsByPhone = new Map<string, Record<string, string>>(
    (fieldLookup.data || []).map((row: { phone: string; fields?: Record<string, string> }) => [row.phone, row.fields || {}]),
  );
  let rateLimited = false;
  const sender = await loadActiveSender(db);

  for (let index = 0; index < rows.length; index += 5) {
    if (rateLimited) break;
    const slice = rows.slice(index, index + 5);
    await Promise.all(
      slice.map(async (row) => {
        if (rateLimited) return;
        const filled = fillParams(params, row.name || '', fieldsByPhone.get(row.phone) || {});
        const result = await sendTemplateMessage({
          phoneNumber: row.phone,
          templateName: String(templateRow.data?.meta?.send_name || campaign.data.template_name),
          templateParams: filled,
          languageCode: campaign.data.language_code || 'en',
          headerImageUrl,
          sender,
        });
        const rateHit = /rate limit|130429|80007/i.test(String(result.error || ''));
        if (rateHit) {
          rateLimited = true;
          return;
        }
        const now = new Date().toISOString();
        await db
          .from('wa_bulk_recipients')
          .update({
            status: result.success ? 'sent' : 'failed',
            error: result.success ? null : result.error || 'Send failed',
            message_id: result.messageId || null,
            sent_at: now,
          })
          .eq('id', row.id);

        const preview = filled.filter(Boolean).join(', ');
        await db.from('whatsapp_messages').insert({
          provider_message_id: result.messageId || null,
          direction: 'OUTBOUND',
          message_type: 'TEMPLATE',
          recipient_phone: row.phone,
          template_name: campaign.data.template_name,
          template_language: campaign.data.language_code || 'en',
          text_body: preview ? `Template: ${campaign.data.template_name} (${preview})` : `Template: ${campaign.data.template_name}`,
          status: result.success ? 'SENT' : 'FAILED',
          status_at: now,
          error_message: result.success ? null : result.error || 'Send failed',
          payload: { source: 'bulk', response: result.raw || null },
          meta: { source: 'bulk', campaign_id: campaignId, actor_id: userId, actor_name: actorName, role_code: role, phone_number_id: sender?.phoneNumberId || null },
          created_by: userId,
          updated_at: now,
        });
      }),
    );
  }

  const [sentCount, failedCount, skippedCount, pendingCount] = await Promise.all([
    db.from('wa_bulk_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'sent'),
    db.from('wa_bulk_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'failed'),
    db.from('wa_bulk_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'skipped'),
    db.from('wa_bulk_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'pending'),
  ]);

  const pendingLeft = pendingCount.count || 0;
  const latest = await db.from('wa_bulk_campaigns').select('status').eq('id', campaignId).maybeSingle();
  const stopped = String(latest.data?.status || '') === 'stopped';
  const done = stopped || (pendingLeft === 0 && !rateLimited);
  await db
    .from('wa_bulk_campaigns')
    .update({
      sent: sentCount.count || 0,
      failed: failedCount.count || 0,
      skipped: skippedCount.count || 0,
      status: stopped ? 'stopped' : done ? 'completed' : 'sending',
      finished_at: done ? new Date().toISOString() : null,
    })
    .eq('id', campaignId);

  return NextResponse.json({
    success: true,
    done,
    stopped,
    rate_limited: rateLimited,
    sent: sentCount.count || 0,
    failed: failedCount.count || 0,
    skipped: skippedCount.count || 0,
    pending: stopped ? 0 : pendingLeft,
  });
}

async function stopCampaign(db: any, body: any) {
  const campaignId = String(body?.campaign_id || '').trim();
  let lookup = db.from('wa_bulk_campaigns').select('id, sent').in('status', ['sending', 'stopped']);
  if (campaignId) lookup = lookup.eq('id', campaignId);
  const found = await lookup;
  if (found.error) return NextResponse.json({ error: found.error.message }, { status: 500 });
  const ids = (found.data || []).map((row: { id: string }) => row.id);
  const now = new Date().toISOString();
  for (const id of ids) {
    await db.from('wa_bulk_recipients').update({ status: 'skipped', error: 'Stopped' }).eq('campaign_id', id).eq('status', 'pending');
    const sent = await db.from('wa_bulk_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'sent');
    await db.from('wa_bulk_campaigns').update({
      status: 'stopped',
      sent: sent.count || 0,
      finished_at: now,
    }).eq('id', id);
  }
  return NextResponse.json({ success: true, stopped: ids.length, sent: (found.data || []).reduce((sum: number, row: { sent?: number }) => sum + Number(row.sent || 0), 0) });
}
