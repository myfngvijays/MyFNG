import { supabase } from './supabase';
import { ENV } from '../config/environment';
import { getCustomerSessionToken } from './customerSession';

type JsonValue = Record<string, any> | any[] | null;

export async function apiFetch<T = JsonValue>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const bearerToken = session?.access_token;
  const customerSessionToken = await getCustomerSessionToken();
  if (!bearerToken && !customerSessionToken) throw new Error('Not authenticated');

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
  if (customerSessionToken) headers['x-customer-session'] = customerSessionToken;

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
