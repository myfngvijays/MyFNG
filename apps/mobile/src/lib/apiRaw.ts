import { getSupabaseAccessToken, withTimeout } from './supabase';
import { ENV } from '../config/environment';
import { getCustomerSessionToken } from './customerSession';
import auth from '@react-native-firebase/auth';
import { Platform } from 'react-native';

const FETCH_TIMEOUT_MS = 20000;

/** Authenticated fetch that returns raw Response (for CSV / binary). */
export async function apiFetchRaw(path: string, options: RequestInit = {}): Promise<Response> {
  let bearerToken: string | undefined;
  try {
    bearerToken = await getSupabaseAccessToken();
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
    firebaseIdToken = firebaseUser
      ? await withTimeout(firebaseUser.getIdToken(), 4000, 'Firebase token')
      : null;
  } catch {
    firebaseIdToken = null;
  }

  if (!bearerToken && !customerSessionToken && !firebaseIdToken) {
    throw new Error('Not authenticated');
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
    'X-App-Platform': Platform.OS,
    'x-mobile-client': 'true',
  };
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
  if (customerSessionToken) headers['x-customer-session'] = customerSessionToken;
  if (firebaseIdToken) headers['x-firebase-id-token'] = firebaseIdToken;

  const controller = new AbortController();
  const fetchTimer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${ENV.API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(fetchTimer);
  }
}
