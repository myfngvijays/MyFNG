import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { Database } from '@/types/database';
import type { NextRequest } from 'next/server';

export const createClient = async () => {
  // Support mobile/external callers that send Authorization: Bearer <token>
  // even when the route handler was written for cookie auth.
  const headerStore = await headers();
  const authHeader = headerStore.get('authorization') || headerStore.get('Authorization');
  const hasBearer = !!authHeader && /^Bearer\s+/i.test(authHeader);

  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
  }

  if (hasBearer) {
    return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: authHeader! } },
    });
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            // Cookie setting might fail in some contexts, ignore silently
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch (error) {
            // Cookie removal might fail in some contexts, ignore silently
          }
        },
      },
    }
  );
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

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const hasBearer = !!authHeader && /^Bearer\s+/i.test(authHeader);

  if (hasBearer) {
    // Use a "normal" supabase-js client with the provided access token.
    // RLS will apply as the user associated with that token.
    return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: authHeader! } },
    });
  }

  // Fallback to cookie-based auth (browser/web).
  return await createClient();
};

