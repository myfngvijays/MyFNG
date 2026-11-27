import type { NextRequest } from 'next/server';

function decodeBase64UrlJson(raw: string): Record<string, unknown> | null {
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
    const jsonStr = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(jsonStr);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function combineAuthCookieChunks(
  cookies: Array<{ name: string; value: string }>,
  baseName: string,
): string {
  const single = cookies.find((c) => c.name === baseName)?.value;
  if (single) return single;
  const parts: string[] = [];
  for (let i = 0; ; i += 1) {
    const chunk = cookies.find((c) => c.name === `${baseName}.${i}`)?.value;
    if (!chunk) break;
    parts.push(chunk);
  }
  return parts.join('');
}

function parseSessionCookieValue(raw: string): { access_token?: string } | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('base64-')) {
    return decodeBase64UrlJson(trimmed.slice('base64-'.length)) as { access_token?: string } | null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
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

/** Read user id from Supabase SSR auth cookie without calling GoTrue (avoids slow/failed getUser). */
export function userFromSupabaseAuthCookies(
  request: NextRequest,
): { id: string; email?: string | null; phone?: string | null } | null {
  const cookies = request.cookies.getAll();
  const bases = new Set<string>();
  for (const c of cookies) {
    if (/^sb-.+-auth-token(?:\.\d+)?$/.test(c.name)) {
      bases.add(c.name.replace(/\.\d+$/, ''));
    }
  }
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');

  for (const base of bases) {
    const raw = combineAuthCookieChunks(cookies, base);
    const session = parseSessionCookieValue(raw);
    const accessToken = String(session?.access_token || '').trim();
    if (!accessToken || accessToken.split('.').length < 3) continue;
    const payload = decodeJwtPayload(accessToken);
    const sub = String(payload?.sub || '').trim();
    if (!sub) continue;
    const exp = Number(payload?.exp || 0);
    if (exp && exp * 1000 < Date.now() - 60_000) continue;
    const iss = String(payload?.iss || '');
    if (supabaseUrl && iss) {
      try {
        const host = new URL(supabaseUrl).host;
        if (!iss.startsWith(supabaseUrl) && !iss.includes(host)) continue;
      } catch {
        continue;
      }
    }
    return {
      id: sub,
      email: typeof payload?.email === 'string' ? payload.email : null,
      phone: typeof payload?.phone === 'string' ? payload.phone : null,
    };
  }
  return null;
}