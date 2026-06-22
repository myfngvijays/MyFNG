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
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (json as any)?.error || 'Request failed';
    throw new Error(message);
  }

  return json as T;
}
