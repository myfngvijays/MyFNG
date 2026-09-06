import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { processLock } from '@supabase/auth-js';
import { ENV } from '../config/environment';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ENV.SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ENV.SUPABASE_ANON_KEY;

if (__DEV__ && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn('Missing Supabase environment variables');
}

/** RN can expose a broken navigator.locks polyfill that deadlocks getSession after idle. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'Request'): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function decodeJwtExpMs(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function tokenIsFresh(token: string, skewMs = 45_000): boolean {
  const exp = decodeJwtExpMs(token);
  if (!exp) return true;
  return exp - skewMs > Date.now();
}

let cachedAccessToken: string | undefined;
let tokenInFlight: Promise<string | undefined> | null = null;

export function rememberAccessToken(token?: string | null) {
  if (!token) return;
  cachedAccessToken = token;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
    lockAcquireTimeout: 4000,
  },
});

void supabase.auth.startAutoRefresh();

AppState.addEventListener('change', (state: AppStateStatus) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
    // Force a fresh JWT so CRM polls after idle do not send an expired bearer (zeros / 401).
    void getSupabaseAccessToken(8000, true).catch(() => undefined);
    return;
  }
  // Keep auto-refresh running in background. Stopping it lets the JWT expire, then
  // getSession deadlocks on the RN lock and dashboards paint 0/0 until a full restart.
});

/** Never hang UI on RN auth lock / token refresh after background. */
export async function getSupabaseAccessToken(
  timeoutMs = 4000,
  forceRefresh = false,
): Promise<string | undefined> {
  if (!forceRefresh && cachedAccessToken && tokenIsFresh(cachedAccessToken)) {
    return cachedAccessToken;
  }
  if (tokenInFlight) return tokenInFlight;

  tokenInFlight = (async () => {
    try {
      if (!forceRefresh) {
        try {
          const { data } = await withTimeout(supabase.auth.getSession(), timeoutMs, 'Auth session');
          const token = data.session?.access_token;
          if (token && tokenIsFresh(token)) {
            rememberAccessToken(token);
            return token;
          }
        } catch {
          /* try refresh */
        }
      }
      const { data } = await withTimeout(
        supabase.auth.refreshSession(),
        Math.max(timeoutMs, 8000),
        'Auth refresh',
      );
      const token = data.session?.access_token;
      rememberAccessToken(token);
      return token;
    } catch {
      if (cachedAccessToken && tokenIsFresh(cachedAccessToken, 0)) return cachedAccessToken;
      return undefined;
    } finally {
      tokenInFlight = null;
    }
  })();

  return tokenInFlight;
}
