export const WA_ACCOUNT_STORAGE_KEY = 'myfng.wa.account';
export const WA_ACCOUNT_EVENT = 'myfng-wa-account';
export const DEFAULT_WHATSAPP_PHONE = '+91 95949 96161';

export type WaAccountChoice = {
  id: string;
  label: string;
  display_phone: string;
  verified_name?: string;
  source: string;
  quality_rating?: string;
  is_active?: boolean;
};

export function last10Digits(value: string) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

export function readStoredWaAccountId() {
  if (typeof window === 'undefined') return 'settings';
  return window.localStorage.getItem(WA_ACCOUNT_STORAGE_KEY) || 'settings';
}

export function writeStoredWaAccountId(id: string) {
  const next = String(id || 'settings').trim() || 'settings';
  window.localStorage.setItem(WA_ACCOUNT_STORAGE_KEY, next);
  window.dispatchEvent(new CustomEvent(WA_ACCOUNT_EVENT, { detail: next }));
}

export function templateMatchesWaAccount(
  template: { meta?: { account_phone?: string } | null },
  account: { source?: string; display_phone?: string } | null,
) {
  const owner = last10Digits(String(template?.meta?.account_phone || ''));
  const selected = last10Digits(account?.display_phone || DEFAULT_WHATSAPP_PHONE);
  if (!account || account.source === 'settings') return !owner || owner === selected;
  return Boolean(selected) && owner === selected;
}

export function flowMatchesWaAccount(
  flow: { account_phone?: string | null },
  account: { source?: string; display_phone?: string } | null,
) {
  const owner = last10Digits(String(flow?.account_phone || ''));
  const selected = last10Digits(account?.display_phone || DEFAULT_WHATSAPP_PHONE);
  if (!account || account.source === 'settings') return !owner || owner === selected;
  return Boolean(selected) && owner === selected;
}
