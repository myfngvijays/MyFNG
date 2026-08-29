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
    void withTimeout(supabase.auth.refreshSession(), 8000, 'Auth refresh').catch(() => undefined);
    return;
  }
  void supabase.auth.stopAutoRefresh();
});

/** Never hang UI on RN auth lock / token refresh after background. */
export async function getSupabaseAccessToken(timeoutMs = 4000): Promise<string | undefined> {
  try {
    const { data } = await withTimeout(supabase.auth.getSession(), timeoutMs, 'Auth session');
    if (data.session?.access_token) return data.session.access_token;
  } catch {
    /* try refresh */
  }
  try {
    const { data } = await withTimeout(supabase.auth.refreshSession(), timeoutMs, 'Auth refresh');
    return data.session?.access_token;
  } catch {
    return undefined;
  }
}
