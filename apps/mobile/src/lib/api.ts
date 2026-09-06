import { getSupabaseAccessToken, withTimeout } from './supabase';
import { ENV } from '../config/environment';
import { getCustomerSessionToken } from './customerSession';
import auth from '@react-native-firebase/auth';
import { Platform } from 'react-native';

type JsonValue = Record<string, any> | any[] | null;

const FETCH_TIMEOUT_MS = 20000;

async function resolveAuthHeaders(forceRefresh = false): Promise<Record<string, string>> {
  let bearerToken: string | undefined;
  try {
    bearerToken = await getSupabaseAccessToken(4000, forceRefresh);
  } catch {
    bearerToken = undefined;
  }

  let customerSessionToken: string | null = null;
  try {
    customerSessionToken = await getCustomerSessionToken();
  } catch {
    customerSessionToken = null;
  }

  // Only pay for Firebase ID token when we have no staff/customer session.
  let firebaseIdToken: string | null = null;
  if (!bearerToken && !customerSessionToken) {
    try {
      const firebaseUser = auth().currentUser;
      firebaseIdToken = firebaseUser
        ? await withTimeout(firebaseUser.getIdToken(), 4000, 'Firebase token')
        : null;
    } catch {
      firebaseIdToken = null;
    }
  }

  if (!bearerToken && !customerSessionToken && !firebaseIdToken) {
    throw new Error('Not authenticated');
  }

  const headers: Record<string, string> = {
    'X-App-Platform': Platform.OS,
    'x-mobile-client': 'true',
  };
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
  if (customerSessionToken) headers['x-customer-session'] = customerSessionToken;
  if (firebaseIdToken) headers['x-firebase-id-token'] = firebaseIdToken;
  return headers;
}

export async function apiFetch<T = JsonValue>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = FETCH_TIMEOUT_MS, headers: optionHeaders, ...fetchOptions } = options;

  const run = async (forceRefresh: boolean) => {
    const authHeaders = await resolveAuthHeaders(forceRefresh);
    const headers: Record<string, string> = {
      ...(optionHeaders as Record<string, string> | undefined),
      ...authHeaders,
    };

    const controller = new AbortController();
    const fetchTimer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${ENV.API_URL}${path}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    }).catch((err: unknown) => {
      const raw = String((err as Error)?.message || err || '');
      const aborted = (err as { name?: string })?.name === 'AbortError';
      if (aborted || /network request failed|failed to fetch|networkerror|timed?\s*out/i.test(raw)) {
        throw new Error(
          'Could not reach the server. Check your internet connection and try again.',
        );
      }
      throw err instanceof Error ? err : new Error(raw || 'Request failed');
    }).finally(() => {
      clearTimeout(fetchTimer);
    });
    return res;
  };

  let res = await run(false);
  if (res.status === 401) {
    res = await run(true);
  }

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
    const details = json?.details ? String(json.details) : '';
    const err = new Error(details ? `${message}: ${details}` : message) as Error & {
      code?: string;
      details?: string;
      payload?: Record<string, unknown>;
    };
    if (json?.code) err.code = String(json.code);
    if (details) err.details = details;
    err.payload = json;
    throw err;
  }

  return json as T;
}

/** Multipart upload (do not set Content-Type — RN sets the boundary). */
export async function apiUpload<T = JsonValue>(path: string, formData: FormData): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: formData as any });
}
