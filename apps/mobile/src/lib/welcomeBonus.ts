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

export function shouldShowGuestWelcomePopup(isLoggedIn: boolean): boolean {
  return !isLoggedIn && !guestPopupShownThisSession;
}

export function markGuestWelcomePopupShown() {
  guestPopupShownThisSession = true;
}

export function resetGuestWelcomePopupSessionFlag() {
  guestPopupShownThisSession = false;
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

  if (authResponse?.is_new_customer === false) return null;

  const fromClaim = await claimWelcomeBonusOnServer(sessionToken);
  if (shouldShowCreditedPopup(fromClaim)) return fromClaim;

  // Do not treat existing wallet balance as a new welcome credit (prevents re-login popup).
  return null;
}

export async function shouldShowWelcomeCreditedPopupForCustomer(
  customerId: string,
  welcomeBonus: WelcomeBonusAuthPayload | null | undefined,
  phone?: string | null,
): Promise<boolean> {
  if (!shouldShowCreditedPopup(welcomeBonus)) return false;
  if (customerId && (await wasWelcomeCreditedPopupShown(customerId))) return false;
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
