import { supabase } from './supabase';
import { ENV } from '../config/environment';
import { getCustomerSessionToken } from './customerSession';
import auth from '@react-native-firebase/auth';
import { Platform } from 'react-native';

/** Authenticated fetch that returns raw Response (for CSV / binary). */
export async function apiFetchRaw(path: string, options: RequestInit = {}): Promise<Response> {
  let bearerToken: string | undefined;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
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

  return fetch(`${ENV.API_URL}${path}`, { ...options, headers });
}
