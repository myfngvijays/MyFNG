import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  applyReportDateRangeFilter,
  resolveReportDateRange,
  rowsToCsv,
  shouldApplyDateRangeFilter,
} from '@/lib/report-date-range';

export type WhatsAppOutboundMessageRow = {
  id: string;
  time: string;
  template_name: string | null;
  phone: string;
  recipient_phone: string | null;
  status: string;
  source: 'automation' | 'manual';
  trigger_key: string | null;
  error_message: string | null;
  text_preview: string | null;
};

type MessageRecord = {
  id?: string;
  created_at?: string | null;
  template_name?: string | null;
  recipient_phone?: string | null;
  status?: string | null;
  error_message?: string | null;
  text_body?: string | null;
  direction?: string | null;
  message_type?: string | null;
  meta?: { source?: string; trigger_key?: string } | null;
};

function normStatus(value: unknown) {
  return String(value || '').trim().toUpperCase() || 'SENT';
}

function maskPhone(phone: string | null | undefined) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '—';
  return `****${digits.slice(-4)}`;
}

function isAutomationMessage(row: MessageRecord) {
  return String(row.meta?.source || '').trim() === 'whatsapp_automation';
}

function mapMessageRow(row: MessageRecord): WhatsAppOutboundMessageRow {
  return {
    id: String(row.id || ''),
    time: String(row.created_at || ''),
    template_name: row.template_name || null,
    phone: maskPhone(row.recipient_phone),
    recipient_phone: row.recipient_phone || null,
    status: normStatus(row.status),
    source: isAutomationMessage(row) ? 'automation' : 'manual',
    trigger_key: row.meta?.trigger_key ? String(row.meta.trigger_key) : null,
    error_message: row.error_message || null,
    text_preview: row.text_body ? String(row.text_body).slice(0, 120) : null,
  };
}

export async function fetchWhatsAppOutboundMessages(options: {
  preset?: string;
  start?: string | null;
  end?: string | null;
  page?: number;
  limit?: number;
  status?: string;
  source?: string;
  template?: string;
  phone?: string;
}) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not available');
  }

  const preset = String(options.preset || 'last_7_days');
  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.min(100, Math.max(1, Number(options.limit || 20)));
  const offset = (page - 1) * limit;
  const range = resolveReportDateRange(preset, options.start, options.end);

  let query = supabaseAdmin
    .from('whatsapp_messages')
    .select(
      'id, created_at, template_name, recipient_phone, status, error_message, text_body, direction, message_type, meta',
      { count: 'exact' }
    )
    .eq('direction', 'OUTBOUND')
    .eq('message_type', 'TEMPLATE')
    .order('created_at', { ascending: false });

  if (shouldApplyDateRangeFilter(preset)) {
    query = applyReportDateRangeFilter(query as any, 'created_at', preset, options.start, options.end) as any;
  }

  const status = String(options.status || 'all').trim().toUpperCase();
  if (status && status !== 'ALL') {
    query = query.eq('status', status);
  }

  const template = String(options.template || '').trim();
  if (template) {
    query = query.ilike('template_name', `%${template}%`);
  }

  const phone = String(options.phone || '').replace(/\D/g, '');
  if (phone) {
    query = query.ilike('recipient_phone', `%${phone}%`);
  }

  const source = String(options.source || 'all').trim().toLowerCase();
  if (source === 'automation') {
    query = query.eq('meta->>source', 'whatsapp_automation');
  } else if (source === 'manual') {
    query = query.or('meta->>source.is.null,meta->>source.neq.whatsapp_automation');
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message || 'Failed to fetch outbound messages');

  const rows = ((data || []) as MessageRecord[]).map(mapMessageRow);

  const total = count || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    preset,
    range_label: range.label,
    from: range.start,
    to: range.end,
    page,
    limit,
    total,
    total_pages: totalPages,
    rows,
  };
}

export function outboundMessagesToCsv(rows: WhatsAppOutboundMessageRow[]) {
  return rowsToCsv(rows as unknown as Record<string, unknown>[], [
    { key: 'time', label: 'Time' },
    { key: 'template_name', label: 'Template' },
    { key: 'trigger_key', label: 'Trigger Key' },
    { key: 'recipient_phone', label: 'Phone' },
    { key: 'status', label: 'Status' },
    { key: 'source', label: 'Source' },
    { key: 'error_message', label: 'Error' },
    { key: 'text_preview', label: 'Preview' },
  ]);
}
