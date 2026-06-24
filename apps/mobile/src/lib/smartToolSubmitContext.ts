import { Platform } from 'react-native';
import auth from '@react-native-firebase/auth';
import { ENV } from '../config/environment';
import { getCustomerSessionToken } from './customerSession';
import { supabase } from './supabase';

export type SmartToolCustomerContext = {
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
};

export async function buildSmartToolSubmitHeaders(): Promise<Record<string, string>> {
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
    const user = auth().currentUser;
    firebaseIdToken = user ? await user.getIdToken() : null;
  } catch {
    firebaseIdToken = null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Platform': Platform.OS,
    'x-mobile-client': 'true',
  };
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
  if (customerSessionToken) headers['x-customer-session'] = customerSessionToken;
  if (firebaseIdToken) headers['x-firebase-id-token'] = firebaseIdToken;
  return headers;
}

/** Resolve logged-in app customer for Smart Tools admin attribution. */
export async function resolveSmartToolCustomerContext(): Promise<SmartToolCustomerContext> {
  try {
    const headers = await buildSmartToolSubmitHeaders();
    const res = await fetch(`${ENV.API_URL}/api/customer/auth/me`, { headers });
    if (!res.ok) return {};
    const json = await res.json();
    const customer = json?.customer;
    if (!customer?.id) return {};
    return {
      customer_id: customer.id,
      customer_name: customer.full_name || undefined,
      customer_phone: customer.phone || undefined,
    };
  } catch {
    return {};
  }
}

export function smartToolPlatform(): 'IOS' | 'ANDROID' {
  return Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
}
