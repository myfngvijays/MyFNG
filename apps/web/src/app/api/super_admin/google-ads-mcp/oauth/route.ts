import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { ADWORDS_SCOPE } from '@/lib/google-ads/client';
import { googleOAuthClient, saveGoogleAdsSettings } from '@/lib/google-ads/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COOKIE = 'gads_oauth_state';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };
  const { data: profile } = await supabase
    .from('users_login')
    .select('id, role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();
  const roleCode = (profile?.role as { role_code?: string } | null)?.role_code;
  if (roleCode !== 'SUPER_ADMIN') return { ok: false as const, status: 403, error: 'Forbidden' };
  return { ok: true as const, userId: String((profile as { id?: string })?.id || user.id) };
}

function originFrom(request: NextRequest) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const origin = originFrom(request);
  const redirectUri = `${origin}/api/super_admin/google-ads-mcp/oauth`;
  const panel = `${origin}/dashboard/super_admin/google-ads-mcp`;
  const oauth = googleOAuthClient();

  if (!code) {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.redirect(new URL('/login', request.url));
    if (!oauth.clientId) {
      return NextResponse.redirect(`${panel}?gads=missing_oauth_client`);
    }
    const state = crypto.randomUUID();
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', oauth.clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', ADWORDS_SCOPE);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');
    googleAuthUrl.searchParams.set('include_granted_scopes', 'true');
    googleAuthUrl.searchParams.set('state', state);
    const res = NextResponse.redirect(googleAuthUrl.toString());
    res.cookies.set(COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    });
    return res;
  }

  const expected = request.cookies.get(COOKIE)?.value || '';
  if (!returnedState || !expected || returnedState !== expected) {
    return NextResponse.redirect(`${panel}?gads=state`);
  }

  const gate = await requireSuperAdmin(request);
  if (!gate.ok) return NextResponse.redirect(new URL('/login', request.url));

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString(),
    cache: 'no-store',
  });
  const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenJson.refresh_token) {
    const hint = encodeURIComponent(tokenJson.error_description || tokenJson.error || 'oauth_failed');
    return NextResponse.redirect(`${panel}?gads=oauth_failed&detail=${hint}`);
  }

  await saveGoogleAdsSettings({ refreshToken: tokenJson.refresh_token }, gate.userId);
  const res = NextResponse.redirect(`${panel}?gads=connected`);
  res.cookies.set(COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
