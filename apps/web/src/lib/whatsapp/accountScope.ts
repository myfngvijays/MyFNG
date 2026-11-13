import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { DEFAULT_WHATSAPP_PHONE, last10Digits } from '@/lib/whatsapp/accountSelection';

export type WaAccountScope = {
  id: string;
  source: 'settings' | 'connected';
  phoneLast10: string;
  phoneNumberId: string;
  otherPhoneLast10: string[];
  otherPhoneNumberIds: string[];
};

function digits(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

export async function loadWaAccountScope(accountId: string): Promise<WaAccountScope> {
  const requested = String(accountId || 'settings').trim() || 'settings';
  const settings: WaAccountScope = {
    id: 'settings',
    source: 'settings',
    phoneLast10: last10Digits(DEFAULT_WHATSAPP_PHONE),
    phoneNumberId: '',
    otherPhoneLast10: [],
    otherPhoneNumberIds: [],
  };
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return settings;

  const saved = await supabaseAdmin
    .from('wa_bulk_accounts')
    .select('id, display_phone, phone_number_id')
    .order('created_at', { ascending: true });
  const rows = saved.error ? [] : saved.data || [];
  settings.otherPhoneLast10 = rows.map((row) => last10Digits(String(row.display_phone || ''))).filter((phone) => phone.length === 10);
  settings.otherPhoneNumberIds = rows.map((row) => digits(row.phone_number_id)).filter(Boolean);

  if (requested === 'settings') return settings;
  const row = rows.find((item) => String(item.id) === requested);
  if (!row) return settings;
  return {
    id: String(row.id),
    source: 'connected',
    phoneLast10: last10Digits(String(row.display_phone || '')),
    phoneNumberId: digits(row.phone_number_id),
    otherPhoneLast10: [],
    otherPhoneNumberIds: [],
  };
}

export function messageInWaScope(row: any, scope: WaAccountScope) {
  const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};
  const nested = meta.metadata && typeof meta.metadata === 'object' ? meta.metadata : {};
  const phoneId = digits(meta.phone_number_id || nested.phone_number_id);
  let business = last10Digits(String(meta.business_phone || nested.display_phone_number || ''));
  if (!business && String(row?.direction || '').toUpperCase() === 'INBOUND') {
    business = last10Digits(String(row?.recipient_phone || ''));
  }
  if (scope.source === 'connected') {
    if (scope.phoneNumberId && phoneId && phoneId === scope.phoneNumberId) return true;
    if (scope.phoneLast10 && business && business === scope.phoneLast10) return true;
    return false;
  }
  if (phoneId && scope.otherPhoneNumberIds.includes(phoneId)) return false;
  if (business && scope.otherPhoneLast10.includes(business)) return false;
  return true;
}

export function templateInWaScope(row: { meta?: { account_phone?: string } | null }, scope: WaAccountScope) {
  const owner = last10Digits(String(row?.meta?.account_phone || ''));
  if (scope.source === 'connected') return Boolean(scope.phoneLast10) && owner === scope.phoneLast10;
  return !owner || owner === scope.phoneLast10;
}
