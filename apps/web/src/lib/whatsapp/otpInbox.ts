import { DEFAULT_WHATSAPP_PHONE, last10Digits } from '@/lib/whatsapp/accountSelection';
import type { WaAccountScope } from '@/lib/whatsapp/accountScope';

export const OTP_CHAT_PREVIEW = 'WhatsApp OTP sent';

export type OtpOutbound = {
  id: string;
  phone: string;
  status: string;
  created_at: string;
  provider_message_id: string | null;
  phone_number_id: string;
};

function digits(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function chatPhone(value: unknown) {
  const raw = digits(value);
  if (!raw) return '';
  const last10 = raw.slice(-10);
  if (last10.length === 10) return `91${last10}`;
  return raw.startsWith('91') ? raw : `91${raw}`;
}

function senderMatchesAccount(phoneNumberId: string, scope: WaAccountScope) {
  if (scope.source === 'connected') {
    return Boolean(scope.phoneNumberId) && phoneNumberId === scope.phoneNumberId;
  }
  if (phoneNumberId && scope.otherPhoneNumberIds.includes(phoneNumberId)) return false;
  return true;
}

/** Recent WhatsApp OTP sends for this business number. OTP codes are never returned. */
export async function loadOtpOutbounds(
  db: any,
  scope: WaAccountScope | null,
  opts?: { phone?: string; limit?: number },
): Promise<OtpOutbound[]> {
  const limit = Math.max(1, Math.min(1000, opts?.limit || 800));
  const phoneLast10 = digits(opts?.phone || '').slice(-10);
  let query = db
    .from('otp_requests')
    .select('id, phone, status, created_at, metadata')
    .eq('channel', 'WHATSAPP')
    .in('status', ['SENT', 'VERIFIED'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (phoneLast10.length === 10) query = query.ilike('phone', `%${phoneLast10}%`);
  if (scope?.source === 'connected' && scope.phoneNumberId) {
    query = query.filter('metadata->>whatsapp_phone_number_id', 'eq', scope.phoneNumberId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows: OtpOutbound[] = [];
  for (const row of data || []) {
    const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const phoneNumberId = digits(meta.whatsapp_phone_number_id);
    if (scope && !senderMatchesAccount(phoneNumberId, scope)) continue;
    const phone = chatPhone(row?.phone);
    if (!phone) continue;
    if (phoneLast10 && !phone.endsWith(phoneLast10)) continue;
    rows.push({
      id: String(row.id),
      phone,
      status: 'SENT',
      created_at: String(row.created_at || ''),
      provider_message_id: String(meta.whatsapp_message_id || '').trim() || null,
      phone_number_id: phoneNumberId,
    });
  }
  return rows;
}

export function otpOutboundToMessage(row: OtpOutbound, businessPhone?: string | null) {
  const at = row.created_at || new Date().toISOString();
  return {
    id: `otp-${row.id}`,
    provider_message_id: row.provider_message_id,
    direction: 'OUTBOUND',
    message_type: 'TEMPLATE',
    sender_phone: businessPhone || null,
    recipient_phone: row.phone,
    template_name: 'otp',
    template_language: 'en',
    text_body: OTP_CHAT_PREVIEW,
    media_url: null,
    media_mime_type: null,
    media_caption: null,
    payload: { source: 'otp' },
    meta: {
      source: 'otp',
      phone_number_id: row.phone_number_id || null,
      business_phone: businessPhone || null,
    },
    status: row.status || 'SENT',
    error_message: null,
    status_at: at,
    created_at: at,
  };
}

export async function archiveSentOtpMessage(
  db: any,
  input: {
    phoneNumberId: string;
    recipientPhone: string;
    messageId?: string | null;
  },
) {
  const phoneNumberId = digits(input.phoneNumberId);
  const recipient = chatPhone(input.recipientPhone);
  if (!phoneNumberId || !recipient) return;

  let businessPhone = '';
  const account = await db
    .from('wa_bulk_accounts')
    .select('display_phone')
    .eq('phone_number_id', phoneNumberId)
    .limit(1)
    .maybeSingle();
  businessPhone = digits(account.data?.display_phone);
  if (!businessPhone && phoneNumberId === digits(process.env.WHATSAPP_PHONE_NUMBER_ID)) {
    businessPhone = digits(DEFAULT_WHATSAPP_PHONE);
  }

  const now = new Date().toISOString();
  const payload = {
    provider_message_id: String(input.messageId || '').trim() || null,
    direction: 'OUTBOUND',
    message_type: 'TEMPLATE',
    sender_phone: businessPhone || null,
    recipient_phone: recipient,
    template_name: 'otp',
    template_language: 'en',
    text_body: OTP_CHAT_PREVIEW,
    status: 'SENT',
    status_at: now,
    payload: { source: 'otp' },
    meta: {
      source: 'otp',
      phone_number_id: phoneNumberId,
      business_phone: businessPhone || null,
    },
    updated_at: now,
  };

  const { error } = await db.from('whatsapp_messages').insert(payload);
  if (!error || !payload.provider_message_id) return;

  await db
    .from('whatsapp_messages')
    .update({
      direction: 'OUTBOUND',
      message_type: 'TEMPLATE',
      sender_phone: payload.sender_phone,
      recipient_phone: recipient,
      template_name: 'otp',
      text_body: OTP_CHAT_PREVIEW,
      meta: payload.meta,
      updated_at: now,
    })
    .eq('provider_message_id', payload.provider_message_id)
    .eq('direction', 'STATUS');
}

export function businessPhoneForScope(scope: WaAccountScope | null) {
  const last10 = last10Digits(scope?.phoneLast10 || '');
  if (last10.length !== 10) return null;
  return `91${last10}`;
}

export function mergeOtpChats(
  chats: any[],
  rows: OtpOutbound[],
  opts?: { searchDigits?: string; searchName?: string },
) {
  const byPhone = new Map<string, any>();
  for (const chat of chats) {
    const phone = chatPhone(chat?.phone);
    if (phone) byPhone.set(phone, { ...chat, phone });
  }
  const searchDigits = digits(opts?.searchDigits || '');
  const searchName = String(opts?.searchName || '').trim().toLowerCase();
  for (const row of rows) {
    if (searchDigits && !row.phone.includes(searchDigits)) continue;
    const existing = byPhone.get(row.phone);
    if (searchName) {
      const name = String(existing?.customer_name || '').toLowerCase();
      if (!name.includes(searchName)) continue;
    }
    const rowTs = new Date(row.created_at || 0).getTime();
    const existingTs = new Date(existing?.last_message_at || 0).getTime();
    if (existing && Number.isFinite(existingTs) && existingTs > rowTs) continue;
    byPhone.set(row.phone, {
      ...(existing || {}),
      phone: row.phone,
      customer_name: existing?.customer_name || null,
      last_message_preview: OTP_CHAT_PREVIEW,
      last_message_type: 'TEMPLATE',
      last_direction: 'OUTBOUND',
      last_status: row.status || 'SENT',
      last_message_at: row.created_at || existing?.last_message_at || null,
      last_inbound_at: existing?.last_inbound_at || null,
      unread_count: existing?.unread_count || 0,
    });
  }
  return Array.from(byPhone.values()).sort(
    (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime(),
  );
}
