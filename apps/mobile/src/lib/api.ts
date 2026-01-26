import { supabase } from './supabase';
import { ENV } from '../config/environment';

type JsonValue = Record<string, any> | any[] | null;

export async function apiFetch<T = JsonValue>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${token}`,
  };

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
