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
};

const WELCOME_POPUP_SHOWN_KEY = 'welcome_credited_popup_customer_ids';

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

export function shouldShowCreditedPopup(welcomeBonus: WelcomeBonusAuthPayload | null | undefined): boolean {
  if (!welcomeBonus) return false;
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

export async function wasWelcomeCreditedPopupShown(customerId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(WELCOME_POPUP_SHOWN_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    return ids.includes(customerId);
  } catch {
    return false;
  }
}

export async function markWelcomeCreditedPopupShown(customerId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(WELCOME_POPUP_SHOWN_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(customerId)) {
      ids.push(customerId);
      await AsyncStorage.setItem(WELCOME_POPUP_SHOWN_KEY, JSON.stringify(ids));
    }
  } catch {
    // ignore storage errors
  }
}

/** Calls claim API + wallet API (triggers server backfill) and reads welcome bonus credit if present. */
export async function claimWelcomeBonusOnServer(sessionToken: string): Promise<WelcomeBonusAuthPayload | null> {
  try {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-customer-session': sessionToken,
      'x-mobile-client': 'true',
      'X-App-Platform': Platform.OS,
    };

    const claimRes = await fetch(`${ENV.API_URL}/api/customer/wallet/claim-welcome`, {
      method: 'POST',
      headers,
    });
    if (claimRes.ok) {
      const contentType = claimRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await claimRes.json();
        const wb = json?.welcome_bonus;
        if (wb && wb.credited && Number(wb.amount || 0) > 0) {
          return {
            credited: true,
            amount: Number(wb.amount),
            expires_at: wb.expires_at || null,
          };
        }
      }
    }
  } catch {
    // fall through to wallet GET
  }
  return null;
}

export async function fetchWalletWelcomeBonus(sessionToken: string): Promise<WelcomeBonusAuthPayload | null> {
  try {
    const res = await fetch(`${ENV.API_URL}/api/customer/wallet`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-customer-session': sessionToken,
        'x-mobile-client': 'true',
        'X-App-Platform': Platform.OS,
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;

    const json = await res.json();
    const txs = Array.isArray(json?.transactions) ? json.transactions : [];
    const welcomeTx = txs.find(
      (t: any) => String(t?.source) === 'WELCOME_BONUS' && String(t?.transaction_type) === 'CREDIT',
    );
    if (!welcomeTx) return null;

    return {
      credited: true,
      amount: Number(welcomeTx.amount || json?.rules?.welcome_bonus_amount || getWelcomeBonusAmount()),
      expires_at: welcomeTx.expires_at || json?.wallet?.welcome_bonus_expires_at || null,
    };
  } catch {
    return null;
  }
}

export async function resolveWelcomeBonusAfterLogin(
  sessionToken: string,
  authResponse?: AuthVerifyResponse | null,
): Promise<WelcomeBonusAuthPayload | null> {
  const fromAuth = parseWelcomeBonusFromAuth(authResponse);
  if (shouldShowCreditedPopup(fromAuth)) return fromAuth;

  const fromClaim = await claimWelcomeBonusOnServer(sessionToken);
  if (shouldShowCreditedPopup(fromClaim)) return fromClaim;

  return fetchWalletWelcomeBonus(sessionToken);
}

export async function shouldShowWelcomeCreditedPopupForCustomer(
  customerId: string,
  welcomeBonus: WelcomeBonusAuthPayload | null | undefined,
): Promise<boolean> {
  if (!customerId || !shouldShowCreditedPopup(welcomeBonus)) return false;
  return !(await wasWelcomeCreditedPopupShown(customerId));
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
): Promise<WelcomeCreditedPopupDecision> {
  const welcomeBonus = await resolveWelcomeBonusAfterLogin(sessionToken, authResponse);
  const amount = Number(welcomeBonus?.amount || getWelcomeBonusAmount());
  if (!customerId) {
    return { show: shouldShowCreditedPopup(welcomeBonus), amount, welcomeBonus };
  }
  const show = await shouldShowWelcomeCreditedPopupForCustomer(String(customerId), welcomeBonus);
  return { show, amount, welcomeBonus };
}
