import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ENV } from '../config/environment';
import { getWalletRules } from './wallet';

export type WelcomeBonusAuthPayload = {
  credited?: boolean;
  amount?: number;
  already_credited?: boolean;
  expires_at?: string | null;
};

export type AuthVerifyResponse = {
  session_token: string;
  welcome_bonus?: WelcomeBonusAuthPayload;
  is_new_customer?: boolean;
  customer?: { id: string; phone?: string; full_name?: string | null };
};

const WELCOME_POPUP_SHOWN_KEY = 'welcome_credited_popup_customer_ids';
const WELCOME_POPUP_SHOWN_PHONES_KEY = 'welcome_credited_popup_phones';
const WELCOME_SOURCE = 'WELCOME_BONUS';
/** Show credited popup if welcome tx landed within this window (auth/claim flags can lag). */
const WELCOME_CREDIT_RECENT_MS = 30 * 60 * 1000;

export function mobileCustomerHeaders(sessionToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-mobile-client': 'true',
    'X-App-Platform': Platform.OS,
  };
  if (sessionToken) headers['x-customer-session'] = sessionToken;
  return headers;
}

export function getWelcomeBonusAmount(fallback = 1000): number {
  const rules = getWalletRules();
  return Number(rules.welcome_bonus_amount || fallback);
}

export function formatWelcomeBonusAmount(amount = getWelcomeBonusAmount()): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function parseWelcomeBonusFromAuth(json: AuthVerifyResponse | null | undefined): WelcomeBonusAuthPayload | null {
  if (!json?.welcome_bonus || typeof json.welcome_bonus !== 'object') return null;
  return json.welcome_bonus;
}

export function resolveCustomerIdFromAuth(
  authResponse?: AuthVerifyResponse | null,
  fallbackProfileId?: string | null,
): string | null {
  const fromAuth = authResponse?.customer?.id;
  if (fromAuth) return String(fromAuth);
  if (fallbackProfileId) return String(fallbackProfileId);
  return null;
}

export function normalizeWelcomePopupPhone(phone?: string | null): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

/** Only true for a fresh credit in this login flow — not existing wallet balance. */
export function shouldShowCreditedPopup(welcomeBonus: WelcomeBonusAuthPayload | null | undefined): boolean {
  if (!welcomeBonus || welcomeBonus.already_credited) return false;
  return Boolean(welcomeBonus.credited) && Number(welcomeBonus.amount || 0) > 0;
}

let guestPopupShownThisSession = false;
const creditedPopupShownThisSession = new Set<string>();

export function shouldShowGuestWelcomePopup(isLoggedIn: boolean): boolean {
  return !isLoggedIn && !guestPopupShownThisSession;
}

export function markGuestWelcomePopupShown() {
  guestPopupShownThisSession = true;
}

export function resetGuestWelcomePopupSessionFlag() {
  guestPopupShownThisSession = false;
}

function creditedSessionKey(customerId?: string | null, phone?: string | null): string | null {
  if (customerId) return `c:${customerId}`;
  const normalized = normalizeWelcomePopupPhone(phone);
  return normalized ? `p:${normalized}` : null;
}

/** Call when opening the credited popup so Login + Home don't stack two Modals. */
export function markWelcomeCreditedPopupQueued(customerId?: string | null, phone?: string | null) {
  const sessionKey = creditedSessionKey(customerId, phone);
  if (sessionKey) creditedPopupShownThisSession.add(sessionKey);
}

async function readStoredIds(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function appendStoredId(key: string, value: string): Promise<void> {
  try {
    const ids = await readStoredIds(key);
    if (!ids.includes(value)) {
      ids.push(value);
      await AsyncStorage.setItem(key, JSON.stringify(ids));
    }
  } catch {
    // ignore storage errors
  }
}

export async function wasWelcomeCreditedPopupShown(customerId: string): Promise<boolean> {
  const ids = await readStoredIds(WELCOME_POPUP_SHOWN_KEY);
  return ids.includes(customerId);
}

export async function wasWelcomeCreditedPopupShownForPhone(phone: string): Promise<boolean> {
  const normalized = normalizeWelcomePopupPhone(phone);
  if (!normalized) return false;
  const phones = await readStoredIds(WELCOME_POPUP_SHOWN_PHONES_KEY);
  return phones.includes(normalized);
}

export async function markWelcomeCreditedPopupShown(
  customerId: string,
  phone?: string | null,
): Promise<void> {
  const sessionKey = creditedSessionKey(customerId, phone);
  if (sessionKey) creditedPopupShownThisSession.add(sessionKey);
  if (customerId) await appendStoredId(WELCOME_POPUP_SHOWN_KEY, customerId);
  const normalizedPhone = normalizeWelcomePopupPhone(phone);
  if (normalizedPhone) await appendStoredId(WELCOME_POPUP_SHOWN_PHONES_KEY, normalizedPhone);
}

/** Calls claim API (triggers server backfill) and returns welcome bonus only if newly credited. */
export async function claimWelcomeBonusOnServer(sessionToken: string): Promise<WelcomeBonusAuthPayload | null> {
  try {
    const claimRes = await fetch(`${ENV.API_URL}/api/customer/wallet/claim-welcome`, {
      method: 'POST',
      headers: mobileCustomerHeaders(sessionToken),
      redirect: 'follow',
    });
    const contentType = claimRes.headers.get('content-type') || '';
    if (claimRes.ok && contentType.includes('application/json')) {
      const json = await claimRes.json();
      const wb = json?.welcome_bonus;
      if (wb?.already_credited) {
        return { credited: false, already_credited: true, amount: 0 };
      }
      if (wb && wb.credited && Number(wb.amount || 0) > 0) {
        return {
          credited: true,
          amount: Number(wb.amount),
          expires_at: wb.expires_at || null,
        };
      }
    }
  } catch {
    // non-fatal
  }
  return null;
}

export async function resolveWelcomeBonusAfterLogin(
  sessionToken: string,
  authResponse?: AuthVerifyResponse | null,
): Promise<WelcomeBonusAuthPayload | null> {
  const fromAuth = parseWelcomeBonusFromAuth(authResponse);
  if (shouldShowCreditedPopup(fromAuth)) return fromAuth;

  const fromClaim = await claimWelcomeBonusOnServer(sessionToken);
  if (shouldShowCreditedPopup(fromClaim)) return fromClaim;

  // Bonus often credits on server while auth/claim return already_credited — read wallet ledger.
  const fromWallet = await fetchRecentWelcomeCredit(sessionToken);
  if (shouldShowCreditedPopup(fromWallet)) return fromWallet;

  return null;
}

export async function clearWelcomeCreditedPopupPhoneBlock(phone?: string | null): Promise<void> {
  const normalized = normalizeWelcomePopupPhone(phone);
  if (!normalized) return;
  try {
    const phones = await readStoredIds(WELCOME_POPUP_SHOWN_PHONES_KEY);
    const next = phones.filter((entry) => entry !== normalized);
    await AsyncStorage.setItem(WELCOME_POPUP_SHOWN_PHONES_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export async function clearWelcomeCreditedPopupCustomerBlock(customerId?: string | null): Promise<void> {
  const id = String(customerId || '').trim();
  if (!id) return;
  try {
    const ids = await readStoredIds(WELCOME_POPUP_SHOWN_KEY);
    const next = ids.filter((entry) => entry !== id);
    await AsyncStorage.setItem(WELCOME_POPUP_SHOWN_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

type WalletLedgerRow = {
  transaction_type?: string;
  source?: string;
  amount?: number | string;
  created_at?: string;
};

/** Wallet is source of truth when verify-otp credited but auth payload missed `credited: true`. */
async function fetchRecentWelcomeCredit(sessionToken: string): Promise<WelcomeBonusAuthPayload | null> {
  try {
    const res = await fetch(`${ENV.API_URL}/api/customer/wallet`, {
      headers: mobileCustomerHeaders(sessionToken),
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    const txs = (Array.isArray(json?.transactions) ? json.transactions : []) as WalletLedgerRow[];
    const cutoff = Date.now() - WELCOME_CREDIT_RECENT_MS;

    const welcomeTx = txs.find((tx) => {
      if (String(tx.transaction_type || '').toUpperCase() !== 'CREDIT') return false;
      if (String(tx.source || '').toUpperCase() !== WELCOME_SOURCE) return false;
      const createdMs = Date.parse(String(tx.created_at || ''));
      return Number.isFinite(createdMs) && createdMs >= cutoff;
    });

    if (!welcomeTx) return null;
    const amount = Number(welcomeTx.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return { credited: true, amount };
  } catch {
    return null;
  }
}

export async function shouldShowWelcomeCreditedPopupForCustomer(
  customerId: string,
  welcomeBonus: WelcomeBonusAuthPayload | null | undefined,
  phone?: string | null,
): Promise<boolean> {
  if (!shouldShowCreditedPopup(welcomeBonus)) return false;
  const sessionKey = creditedSessionKey(customerId, phone);
  if (sessionKey && creditedPopupShownThisSession.has(sessionKey)) return false;
  if (customerId) {
    if (await wasWelcomeCreditedPopupShown(customerId)) return false;
    return true;
  }
  const normalizedPhone = normalizeWelcomePopupPhone(phone);
  if (normalizedPhone && (await wasWelcomeCreditedPopupShownForPhone(normalizedPhone))) return false;
  return true;
}

export type WelcomeCreditedPopupDecision = {
  show: boolean;
  amount: number;
  welcomeBonus: WelcomeBonusAuthPayload | null;
};

export async function decideWelcomeCreditedPopup(
  sessionToken: string,
  customerId: string | null | undefined,
  authResponse?: AuthVerifyResponse | null,
  phone?: string | null,
): Promise<WelcomeCreditedPopupDecision> {
  const resolvedCustomerId = resolveCustomerIdFromAuth(authResponse, customerId);
  const resolvedPhone =
    normalizeWelcomePopupPhone(phone) ||
    normalizeWelcomePopupPhone(authResponse?.customer?.phone) ||
    null;
  const welcomeBonus = await resolveWelcomeBonusAfterLogin(sessionToken, authResponse);
  const amount = Number(welcomeBonus?.amount || getWelcomeBonusAmount());

  // Do NOT clear "already shown" markers here — that re-opens welcome on every home
  // focus while a recent wallet credit exists, stacking Modals and freezing home scroll.

  if (!resolvedCustomerId && !resolvedPhone) {
    return { show: shouldShowCreditedPopup(welcomeBonus), amount, welcomeBonus };
  }

  const show = await shouldShowWelcomeCreditedPopupForCustomer(
    resolvedCustomerId || '',
    welcomeBonus,
    resolvedPhone,
  );
  return { show, amount, welcomeBonus };
}
