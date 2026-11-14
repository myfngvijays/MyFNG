import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { DEFAULT_WHATSAPP_PHONE, last10Digits } from '@/lib/whatsapp/accountSelection';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];
const CHANNELS = ['SMS', 'WHATSAPP', 'EMAIL'] as const;
const STATUSES = ['SENT', 'VERIFIED', 'FAILED'] as const;

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();
  const role = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '').toUpperCase();
  return Boolean(profile && ALLOWED_ROLES.includes(role));
}

function historyRange(params: URLSearchParams) {
  const from = String(params.get('from') || '');
  const to = String(params.get('to') || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const start = new Date(`${from}T00:00:00+05:30`);
    const end = new Date(`${to}T23:59:59.999+05:30`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start.getTime() <= end.getTime()) {
      return { since: start.toISOString(), until: end.toISOString() };
    }
  }
  const days = [1, 7, 30].includes(Number(params.get('days'))) ? Number(params.get('days')) : 7;
  return {
    since: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
    until: new Date().toISOString(),
  };
}

function lastDigits(value: string, count: number) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.slice(-count);
}

function formatIndian(value: string) {
  const digits = last10Digits(value);
  if (digits.length !== 10) return '';
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

function accountLabel(displayPhone: string, phoneNumberId: string, primary: boolean) {
  const formatted = formatIndian(displayPhone);
  if (formatted) return formatted;
  if (primary) return DEFAULT_WHATSAPP_PHONE;
  const idTail = lastDigits(phoneNumberId, 4);
  return idTail ? `Number •${idTail}` : 'WhatsApp number';
}

function inferSender(
  row: { channel?: string | null; created_at?: string | null; metadata?: Record<string, unknown> | null },
  primaryId: string,
  secondaryId: string,
  cutoverMs: number,
) {
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const stamped = String(meta.whatsapp_phone_number_id || '').replace(/\D/g, '');
  if (stamped) return stamped;
  if (String(row.channel || '').toUpperCase() !== 'WHATSAPP') return '';
  const error = String(meta.whatsapp_error || '');
  const at = new Date(String(row.created_at || '')).getTime();
  if (/not on this number/i.test(error) && secondaryId) return secondaryId;
  if (secondaryId && cutoverMs && Number.isFinite(at) && at >= cutoverMs) return secondaryId;
  return primaryId;
}

function publicRow(
  row: {
    id: string;
    phone?: string | null;
    channel?: string | null;
    provider?: string | null;
    status?: string | null;
    created_at?: string | null;
    metadata?: Record<string, unknown> | null;
  },
  senderPhoneNumberId: string,
) {
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const tried = Array.isArray(meta.whatsapp_tried_phone_number_ids)
    ? meta.whatsapp_tried_phone_number_ids.map((item) => String(item || '')).filter(Boolean)
    : [];
  return {
    id: row.id,
    phone: String(row.phone || ''),
    channel: String(row.channel || 'SMS').toUpperCase(),
    provider: String(row.provider || ''),
    status: String(row.status || ''),
    created_at: row.created_at,
    email: typeof meta.email === 'string' ? meta.email : '',
    sender_phone_number_id: senderPhoneNumberId,
    tried_phone_number_ids: tried.length ? tried : (senderPhoneNumberId ? [senderPhoneNumberId] : []),
    error: String(meta.whatsapp_error || meta.email_error || meta.sms_error || '').slice(0, 180),
  };
}

export async function GET(request: NextRequest) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;
  const channel = String(params.get('channel') || 'ALL').toUpperCase();
  const account = String(params.get('account') || '').replace(/\D/g, '').slice(0, 24);
  const queryText = String(params.get('q') || '').replace(/[^a-zA-Z0-9@.+_-]/g, '').slice(0, 40);
  const { since, until } = historyRange(params);

  const db = supabaseAdmin as any;
  let list = db
    .from('otp_requests')
    .select('id, phone, channel, provider, status, metadata, created_at')
    .gte('created_at', since)
    .lte('created_at', until)
    .order('created_at', { ascending: false })
    .limit(200);
  if (CHANNELS.includes(channel as (typeof CHANNELS)[number])) list = list.eq('channel', channel);
  if (queryText.includes('@')) list = list.filter('metadata->>email', 'ilike', `%${queryText}%`);
  else if (queryText) list = list.ilike('phone', `%${queryText}%`);

  const countJobs = CHANNELS.flatMap((itemChannel) => STATUSES.map(async (status) => {
    const { count } = await db
      .from('otp_requests')
      .select('id', { count: 'exact', head: true })
      .eq('channel', itemChannel)
      .eq('status', status)
      .gte('created_at', since)
      .lte('created_at', until);
    return { channel: itemChannel, status, count: count || 0 };
  }));

  const [listResult, accountResult, markerResult, ...counts] = await Promise.all([
    list,
    db.from('wa_bulk_accounts').select('label, display_phone, phone_number_id, verified_name, quality_rating, is_active, created_at'),
    db.from('otp_requests')
      .select('created_at')
      .eq('channel', 'WHATSAPP')
      .filter('metadata->>whatsapp_error', 'ilike', '%not on this number%')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    ...countJobs,
  ]);

  if (listResult.error) {
    return NextResponse.json({ error: listResult.error.message }, { status: 500 });
  }

  const envPhoneId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').replace(/\D/g, '');
  const accountRows = (accountResult.data || []) as Array<Record<string, string | boolean>>;
  const accounts = accountRows.map((row) => {
    const phoneNumberId = String(row.phone_number_id || '');
    const primary = phoneNumberId === envPhoneId;
    return {
      phone_number_id: phoneNumberId,
      label: accountLabel(String(row.display_phone || ''), phoneNumberId, primary),
      name: String(row.verified_name || row.label || ''),
      quality: String(row.quality_rating || ''),
      active: Boolean(row.is_active),
      created_at: String(row.created_at || ''),
    };
  }).filter((row) => row.phone_number_id);

  if (envPhoneId && !accounts.some((row) => row.phone_number_id === envPhoneId)) {
    accounts.unshift({
      phone_number_id: envPhoneId,
      label: DEFAULT_WHATSAPP_PHONE,
      name: 'WhatsApp settings',
      quality: '',
      active: true,
      created_at: '',
    });
  }

  const secondary = accounts.find((row) => row.phone_number_id !== envPhoneId);
  const markerAt = new Date(String(markerResult.data?.created_at || '')).getTime();
  const accountAt = new Date(String(secondary?.created_at || '')).getTime();
  const cutoverMs = Number.isFinite(markerAt) && markerAt > 0
    ? markerAt
    : (Number.isFinite(accountAt) && accountAt > 0 ? accountAt : 0);

  const summary = {
    SMS: { SENT: 0, VERIFIED: 0, FAILED: 0 },
    WHATSAPP: { SENT: 0, VERIFIED: 0, FAILED: 0 },
    EMAIL: { SENT: 0, VERIFIED: 0, FAILED: 0 },
  };
  for (const item of counts) {
    summary[item.channel][item.status] = item.count;
  }

  const rows = ((listResult.data || []) as Array<{
    id: string;
    phone?: string | null;
    channel?: string | null;
    provider?: string | null;
    status?: string | null;
    created_at?: string | null;
    metadata?: Record<string, unknown> | null;
  }>).map((row) => publicRow(
    row,
    inferSender(row, envPhoneId, secondary?.phone_number_id || '', cutoverMs),
  )).filter((row) => !account || row.sender_phone_number_id === account);

  return NextResponse.json({
    from: params.get('from') || '',
    to: params.get('to') || '',
    accounts: accounts.map(({ created_at: _created, ...account }) => account),
    summary,
    rows,
  });
}
