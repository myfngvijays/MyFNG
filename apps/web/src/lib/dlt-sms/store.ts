import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  countByStatus,
  defaultEntity,
  emptyCounts,
  isValidHeader,
  normalizeHeader,
  type DltSmsCta,
  type DltSmsEntity,
  type DltSmsHeader,
  type DltSmsLog,
  type DltSmsSnapshot,
  type DltSmsTelemarketer,
  type DltSmsTemplate,
  type DltSetupStep,
} from './types';

function admin(): any {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error(error || 'Supabase admin client unavailable');
  }
  return supabaseAdmin;
}

function maskKey(key: string): string {
  const trimmed = String(key || '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= 4) return '••••';
  return `••••${trimmed.slice(-4)}`;
}

export async function getDltEntity(): Promise<DltSmsEntity> {
  const client = admin();
  const { data, error } = await client
    .from('dlt_sms_entity')
    .select('*')
    .eq('config_key', 'default')
    .maybeSingle();
  if (error) {
    if (/does not exist|relation|42P01|PGRST205/i.test(error.message)) {
      throw new Error('DLT SMS tables missing. Run database/352_dlt_sms.sql');
    }
    throw new Error(error.message);
  }
  return data ? (data as DltSmsEntity) : defaultEntity();
}

export async function saveDltEntity(
  patch: Partial<DltSmsEntity>,
  userId?: string | null,
): Promise<DltSmsEntity> {
  const client = admin();
  const current = await getDltEntity();
  const next = {
    config_key: 'default',
    pe_id: String(patch.pe_id ?? current.pe_id ?? '').trim(),
    pe_name: String(patch.pe_name ?? current.pe_name ?? '').trim(),
    brand_name: String(patch.brand_name ?? current.brand_name ?? 'MyFNG').trim() || 'MyFNG',
    operator: String(patch.operator ?? current.operator ?? 'JIO').trim().toUpperCase() || 'JIO',
    portal_url:
      String(patch.portal_url ?? current.portal_url ?? 'https://trueconnect.jio.com').trim() ||
      'https://trueconnect.jio.com',
    entity_status: patch.entity_status || current.entity_status || 'PENDING',
    pan: String(patch.pan ?? current.pan ?? '').trim(),
    gstin: String(patch.gstin ?? current.gstin ?? '').trim(),
    registered_address: String(patch.registered_address ?? current.registered_address ?? '').trim(),
    admin_notes: String(patch.admin_notes ?? current.admin_notes ?? '').trim(),
    updated_at: new Date().toISOString(),
    updated_by: userId || null,
  };

  const { data, error } = await client
    .from('dlt_sms_entity')
    .upsert(next, { onConflict: 'config_key' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as DltSmsEntity;
}

function publicTelemarketer(row: any): DltSmsTelemarketer {
  const apiKey = String(row?.api_key || '');
  return {
    id: String(row.id),
    name: String(row.name || ''),
    provider: row.provider,
    tm_id: String(row.tm_id || ''),
    has_api_key: apiKey.length > 0,
    api_key_hint: maskKey(apiKey),
    api_url: String(row.api_url || ''),
    default_header: String(row.default_header || ''),
    is_primary: Boolean(row.is_primary),
    is_active: Boolean(row.is_active),
    extra_config: row.extra_config && typeof row.extra_config === 'object' ? row.extra_config : {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getDltSnapshot(logLimit = 40): Promise<DltSmsSnapshot> {
  const client = admin();
  const [entity, headersRes, templatesRes, tmRes, ctaRes, logsRes] = await Promise.all([
    getDltEntity(),
    client.from('dlt_sms_headers').select('*').order('created_at', { ascending: false }),
    client.from('dlt_sms_templates').select('*').order('created_at', { ascending: false }),
    client.from('dlt_sms_telemarketers').select('*').order('created_at', { ascending: false }),
    client.from('dlt_sms_cta').select('*').order('created_at', { ascending: false }),
    client.from('dlt_sms_logs').select('*').order('created_at', { ascending: false }).limit(logLimit),
  ]);

  const firstError =
    headersRes.error || templatesRes.error || tmRes.error || ctaRes.error || logsRes.error;
  if (firstError) {
    if (/does not exist|relation|42P01|PGRST205/i.test(firstError.message)) {
      throw new Error('DLT SMS tables missing. Run database/352_dlt_sms.sql');
    }
    throw new Error(firstError.message);
  }

  const headers = (headersRes.data || []) as DltSmsHeader[];
  const headerById = new Map(headers.map((h) => [h.id, h.header]));
  const templates = ((templatesRes.data || []) as DltSmsTemplate[]).map((t) => ({
    ...t,
    variables: Array.isArray(t.variables) ? t.variables : [],
    header: t.header_id ? headerById.get(t.header_id) || null : null,
  }));
  const consentTemplates = templates.filter((t) => t.kind === 'CONSENT');
  const contentTemplates = templates.filter((t) => t.kind === 'CONTENT');
  const telemarketers = (tmRes.data || []).map(publicTelemarketer);
  const cta = (ctaRes.data || []) as DltSmsCta[];
  const logs = (logsRes.data || []) as DltSmsLog[];

  const entityCounts = emptyCounts();
  entityCounts.total = 1;
  if (entity.entity_status === 'APPROVED') entityCounts.approved = 1;
  else if (entity.entity_status === 'PENDING') entityCounts.pending = 1;
  else if (entity.entity_status === 'REJECTED') entityCounts.rejected = 1;

  const primaryTm = telemarketers.find(
    (t) => t.is_primary && t.is_active && (t.has_api_key || Boolean(t.api_url)),
  );
  const approvedHeader = headers.some((h) => h.status === 'APPROVED');
  const approvedContent = contentTemplates.some(
    (t) => t.status === 'APPROVED' && String(t.dlt_template_id || t.provider_template_id || '').trim(),
  );

  const setupSteps: DltSetupStep[] = [
    {
      id: 'entity',
      label: 'Principal Entity approved on DLT',
      done: entity.entity_status === 'APPROVED' && Boolean(entity.pe_id),
      hint: 'Copy PE ID from Jio TrueConnect (already approved for this account).',
    },
    {
      id: 'header',
      label: 'SMS header registered & approved',
      done: approvedHeader,
      hint: 'Submit 3–6 character sender ID (e.g. MYFNG) on the operator portal, then mark Approved here.',
    },
    {
      id: 'content',
      label: 'Content template approved with DLT ID',
      done: approvedContent,
      hint: 'Paste the TRAI Template ID after Jio approves the SMS body.',
    },
    {
      id: 'telemarketer',
      label: 'Own operator SMS pipe connected',
      done: Boolean(primaryTm && primaryTm.api_url),
      hint: 'No MSG91. Register yourselves as telemarketer on Jio TrueConnect, then paste the operator HTTP URL Jio gives you.',
    },
    {
      id: 'cta',
      label: 'CTA / links whitelisted (if SMS has URLs)',
      done: cta.some((c) => c.status === 'APPROVED') || cta.length === 0,
      hint: 'Required only when templates include URLs or numbers. Skip if templates have no links.',
    },
  ];

  return {
    entity,
    stats: {
      entity: entityCounts,
      headers: countByStatus(headers),
      consent: countByStatus(consentTemplates),
      content: countByStatus(contentTemplates),
      cta: countByStatus(cta),
    },
    headers,
    consentTemplates,
    contentTemplates,
    telemarketers,
    cta,
    logs,
    setupSteps,
    readyToSend: Boolean(primaryTm && primaryTm.api_url && approvedHeader && approvedContent),
  };
}

export async function upsertHeader(
  input: Partial<DltSmsHeader> & { header: string },
  userId?: string | null,
): Promise<DltSmsHeader> {
  const header = normalizeHeader(input.header);
  if (!isValidHeader(header)) {
    throw new Error('Header must be 3–6 letters/numbers (TRAI sender ID).');
  }
  const client = admin();
  const row = {
    ...(input.id ? { id: input.id } : {}),
    header,
    header_type: input.header_type || 'TRANS',
    status: input.status || 'PENDING',
    dlt_header_id: String(input.dlt_header_id || '').trim(),
    notes: String(input.notes || '').trim(),
    updated_at: new Date().toISOString(),
    created_by: userId || null,
  };
  const { data, error } = await client.from('dlt_sms_headers').upsert(row).select('*').single();
  if (error) throw new Error(error.message);
  return data as DltSmsHeader;
}

export async function deleteById(table: string, id: string): Promise<void> {
  const client = admin();
  const { error } = await client.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

function parseVariables(text: string, explicit?: string[]): string[] {
  if (Array.isArray(explicit) && explicit.length) {
    return explicit.map((v) => String(v).trim()).filter(Boolean);
  }
  const found = new Set<string>();
  const re = /\{#([^#]+)#\}|\{\{(\w+)\}\}|\{([a-zA-Z][\w]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    found.add(String(match[1] || match[2] || match[3]).trim());
  }
  return [...found];
}

export async function upsertTemplate(
  input: Partial<DltSmsTemplate> & { name: string; kind: 'CONSENT' | 'CONTENT' },
  userId?: string | null,
): Promise<DltSmsTemplate> {
  const templateText = String(input.template_text || '').trim();
  if (!templateText) throw new Error('Template text is required');
  const client = admin();
  const row = {
    ...(input.id ? { id: input.id } : {}),
    kind: input.kind,
    name: String(input.name).trim(),
    header_id: input.header_id || null,
    category: input.category || 'TRANSACTIONAL',
    template_text: templateText,
    variables: parseVariables(templateText, input.variables),
    dlt_template_id: String(input.dlt_template_id || '').trim(),
    provider_template_id: String(input.provider_template_id || '').trim(),
    event_key: String(input.event_key || '').trim(),
    status: input.status || 'PENDING',
    notes: String(input.notes || '').trim(),
    updated_at: new Date().toISOString(),
    created_by: userId || null,
  };
  const { data, error } = await client.from('dlt_sms_templates').upsert(row).select('*').single();
  if (error) throw new Error(error.message);
  return data as DltSmsTemplate;
}

export async function upsertTelemarketer(
  input: {
    id?: string;
    name: string;
    provider?: string;
    tm_id?: string;
    api_key?: string;
    clear_api_key?: boolean;
    api_url?: string;
    default_header?: string;
    is_primary?: boolean;
    is_active?: boolean;
    extra_config?: Record<string, unknown>;
  },
  userId?: string | null,
): Promise<DltSmsTelemarketer> {
  const client = admin();
  let existingKey = '';
  if (input.id) {
    const { data } = await client
      .from('dlt_sms_telemarketers')
      .select('api_key')
      .eq('id', input.id)
      .maybeSingle();
    existingKey = String(data?.api_key || '');
  }

  let apiKey = existingKey;
  if (input.clear_api_key) apiKey = '';
  else if (input.api_key && String(input.api_key).trim() && !String(input.api_key).includes('•')) {
    apiKey = String(input.api_key).trim();
  }

  if (input.is_primary) {
    await client.from('dlt_sms_telemarketers').update({ is_primary: false }).neq('id', input.id || '00000000-0000-0000-0000-000000000000');
  }

  const row = {
    ...(input.id ? { id: input.id } : {}),
    name: String(input.name).trim(),
    provider: input.provider || 'MYFNG',
    tm_id: String(input.tm_id || '').trim(),
    api_key: apiKey,
    api_url: String(input.api_url || '').trim(),
    default_header: normalizeHeader(String(input.default_header || '')) || '',
    is_primary: Boolean(input.is_primary),
    is_active: input.is_active !== false,
    extra_config: input.extra_config && typeof input.extra_config === 'object' ? input.extra_config : {},
    updated_at: new Date().toISOString(),
    created_by: userId || null,
  };

  const { data, error } = await client.from('dlt_sms_telemarketers').upsert(row).select('*').single();
  if (error) throw new Error(error.message);
  return publicTelemarketer(data);
}

export async function getPrimaryTelemarketerRaw(): Promise<any | null> {
  const client = admin();
  const { data } = await client
    .from('dlt_sms_telemarketers')
    .select('*')
    .eq('is_active', true)
    .eq('is_primary', true)
    .maybeSingle();
  if (data?.api_url || data?.api_key) return data;
  const { data: anyActive } = await client
    .from('dlt_sms_telemarketers')
    .select('*')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return anyActive?.api_url || anyActive?.api_key ? anyActive : null;
}

export async function getApprovedTemplateByEvent(eventKey: string): Promise<DltSmsTemplate | null> {
  if (!eventKey) return null;
  const client = admin();
  const { data } = await client
    .from('dlt_sms_templates')
    .select('*')
    .eq('kind', 'CONTENT')
    .eq('status', 'APPROVED')
    .eq('event_key', eventKey)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as DltSmsTemplate) || null;
}

export async function getTemplateById(id: string): Promise<DltSmsTemplate | null> {
  const client = admin();
  const { data } = await client.from('dlt_sms_templates').select('*').eq('id', id).maybeSingle();
  return (data as DltSmsTemplate) || null;
}

export async function upsertCta(
  input: Partial<DltSmsCta> & { value: string },
  userId?: string | null,
): Promise<DltSmsCta> {
  const client = admin();
  const row = {
    ...(input.id ? { id: input.id } : {}),
    cta_type: input.cta_type || 'URL',
    value: String(input.value).trim(),
    status: input.status || 'PENDING',
    notes: String(input.notes || '').trim(),
    updated_at: new Date().toISOString(),
    created_by: userId || null,
  };
  const { data, error } = await client.from('dlt_sms_cta').upsert(row).select('*').single();
  if (error) throw new Error(error.message);
  return data as DltSmsCta;
}

export async function insertLog(row: {
  phone: string;
  template_id?: string | null;
  header?: string;
  message: string;
  provider: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  provider_message_id?: string;
  error?: string;
  created_by?: string | null;
}): Promise<void> {
  const client = admin();
  await client.from('dlt_sms_logs').insert({
    phone: row.phone,
    template_id: row.template_id || null,
    header: row.header || '',
    message: row.message,
    provider: row.provider,
    status: row.status,
    provider_message_id: row.provider_message_id || '',
    error: row.error || '',
    created_by: row.created_by || null,
  });
}

export async function listLogs(limit = 80): Promise<DltSmsLog[]> {
  const client = admin();
  const { data, error } = await client
    .from('dlt_sms_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as DltSmsLog[];
}
