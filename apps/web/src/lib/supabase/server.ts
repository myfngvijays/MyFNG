import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { Database } from '@/types/database';
import type { NextRequest } from 'next/server';

function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = (match?.[1] || '').trim();
  // Ignore empty / placeholder / non-JWT tokens that would override cookie auth.
  if (!token || token.length < 20) return null;
  if (token.split('.').length < 3) return null;
  return token;
}

function hasSupabaseAuthCookie(
  cookieList: Array<{ name: string; value?: string }>,
): boolean {
  return cookieList.some(
    (c) =>
      !!c.value &&
      (/auth-token/i.test(c.name) || /^sb-.*-auth-token/i.test(c.name)),
  );
}

function buildCookieClient(
  supabaseUrl: string,
  supabaseKey: string,
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  request?: NextRequest,
) {
  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return request?.cookies.get(name)?.value ?? cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set(name, value, options);
        } catch {
          // Cookie setting might fail in some contexts, ignore silently
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set(name, '', { ...options, maxAge: 0 });
        } catch {
          // Cookie removal might fail in some contexts, ignore silently
        }
      },
    },
  });
}

export const createClient = async () => {
  // Support mobile/external callers that send Authorization: Bearer <token>
  // even when the route handler was written for cookie auth.
  // Prefer cookies when a Supabase session cookie is present so a junk/stale
  // Authorization header cannot force Unauthorized on browser dashboard calls.
  const headerStore = await headers();
  const authHeader = headerStore.get('authorization') || headerStore.get('Authorization');
  const bearer = extractBearerToken(authHeader);

  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
  }

  const cookieAuth = hasSupabaseAuthCookie(cookieStore.getAll());
  if (bearer && !cookieAuth) {
    return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
  }

  return buildCookieClient(supabaseUrl, supabaseKey, cookieStore);
};

/**
 * Create a Supabase client for Route Handlers that works for:
 * - Web: cookie-based auth (default)
 * - Mobile/External: Authorization: Bearer <access_token>
 *
 * This is important because React Native clients don't automatically share Next.js cookies.
 */
export const createClientFromRequest = async (request: NextRequest) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
  }

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const bearer = extractBearerToken(authHeader);
  const cookieStore = await cookies();
  const requestCookies = request.cookies.getAll();
  const cookieAuth =
    hasSupabaseAuthCookie(requestCookies) || hasSupabaseAuthCookie(cookieStore.getAll());

  if (bearer && !cookieAuth) {
    return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
  }

  return buildCookieClient(supabaseUrl, supabaseKey, cookieStore, request);
};
