import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

type AuthUser = Pick<User, 'id'> & { email?: string | null; phone?: string | null };

type AuthOk = { ok: true; user: AuthUser };
type AuthFail = { ok: false; status: number; error: string };

function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = (match?.[1] || '').trim();
  if (!token || token.length < 20) return null;
  if (token.split('.').length < 3) return null;
  return token;
}

function isAuthNetworkError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || '');
  return /timeout|timed out|fetch failed|ConnectTimeout|ECONNRESET|ENOTFOUND|network|AUTH_TIMEOUT/i.test(
    msg,
  );
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1] || '';
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function userFromBearer(request: NextRequest): AuthUser | null {
  const token = extractBearerToken(
    request.headers.get('authorization') || request.headers.get('Authorization'),
  );
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const sub = String(payload?.sub || '').trim();
  if (!sub) return null;
  const exp = Number(payload?.exp || 0);
  if (exp && exp * 1000 < Date.now() - 30_000) return null;
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const iss = String(payload?.iss || '');
  if (supabaseUrl && iss) {
    try {
      const host = new URL(supabaseUrl).host;
      if (!iss.startsWith(supabaseUrl) && !iss.includes(host)) return null;
    } catch {
      return null;
    }
  }
  return {
    id: sub,
    email: typeof payload?.email === 'string' ? payload.email : null,
    phone: typeof payload?.phone === 'string' ? payload.phone : null,
  };
}

async function getUserWithCap(
  supabase: { auth: { getUser: () => Promise<{ data: { user: User | null }; error: { message?: string } | null }> } },
  capMs = 4000,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null }; error: { message: string } }>((resolve) => {
        timer = setTimeout(
          () => resolve({ data: { user: null }, error: { message: 'AUTH_TIMEOUT' } }),
          capMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Cookie/Bearer getUser, with JWT fallback when GoTrue is slow or timed out. */
export async function getRequestUser(
  supabase: { auth: { getUser: () => Promise<{ data: { user: User | null }; error: { message?: string } | null }> } },
  request: NextRequest,
): Promise<AuthOk | AuthFail> {
  try {
    const { data, error } = await getUserWithCap(supabase);
    if (data?.user?.id) return { ok: true, user: data.user };
    const fallback = userFromBearer(request);
    if (fallback) return { ok: true, user: fallback };
    if (error && isAuthNetworkError(error)) {
      return { ok: false, status: 503, error: 'Could not reach auth. Retry.' };
    }
    return { ok: false, status: 401, error: 'Unauthorized' };
  } catch (e) {
    const fallback = userFromBearer(request);
    if (fallback) return { ok: true, user: fallback };
    if (isAuthNetworkError(e)) {
      return { ok: false, status: 503, error: 'Could not reach auth. Retry.' };
    }
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
}
