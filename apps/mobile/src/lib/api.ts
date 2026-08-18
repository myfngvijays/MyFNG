import { supabase } from './supabase';
import { ENV } from '../config/environment';
import { getCustomerSessionToken } from './customerSession';
import auth from '@react-native-firebase/auth';
import { Platform } from 'react-native';

type JsonValue = Record<string, any> | any[] | null;

export async function apiFetch<T = JsonValue>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // Each token source is resolved independently so a failure in one
  // (e.g. Firebase native module unavailable, token refresh error) never
  // breaks an authenticated request when another valid token exists.
  let bearerToken: string | undefined;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    bearerToken = session?.access_token;
    // Stale/missing access token — try one refresh before failing auth
    if (!bearerToken) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      bearerToken = refreshed.session?.access_token;
    }
  } catch {
    bearerToken = undefined;
  }

  let customerSessionToken: string | null = null;
  try {
    customerSessionToken = await getCustomerSessionToken();
  } catch {
    customerSessionToken = null;
  }

  let firebaseIdToken: string | null = null;
  try {
    const firebaseUser = auth().currentUser;
    firebaseIdToken = firebaseUser ? await firebaseUser.getIdToken() : null;
  } catch {
    firebaseIdToken = null;
  }

  if (!bearerToken && !customerSessionToken && !firebaseIdToken) throw new Error('Not authenticated');

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
    'X-App-Platform': Platform.OS,
    'x-mobile-client': 'true',
  };
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
  if (customerSessionToken) headers['x-customer-session'] = customerSessionToken;
  if (firebaseIdToken) headers['x-firebase-id-token'] = firebaseIdToken;

  const res = await fetch(`${ENV.API_URL}${path}`, {
    ...options,
    headers,
  }).catch((err: unknown) => {
    const raw = String((err as Error)?.message || err || '');
    if (/network request failed|failed to fetch|networkerror|timed?\s*out/i.test(raw)) {
      throw new Error(
        'Could not reach the server. Check your internet connection and try again.',
      );
    }
    throw err instanceof Error ? err : new Error(raw || 'Request failed');
  });

  const text = await res.text().catch(() => '');
  let json: Record<string, unknown> = {};
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error(
          res.status === 404
            ? 'This feature is not available yet. Please update the app or try again later.'
            : `Service unavailable (${res.status}). Please try again in a moment.`,
        );
      }
      json = {};
    }
  }
  if (!res.ok) {
    const message = String(json?.error || 'Request failed');
    throw new Error(message);
  }

  return json as T;
}
