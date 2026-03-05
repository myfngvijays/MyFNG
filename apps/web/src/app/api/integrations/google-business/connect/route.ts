import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getClientId() {
  return (
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    ''
  );
}

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientId();
    if (!clientId) {
      return NextResponse.json(
        { error: 'Google OAuth client ID not configured on server' },
        { status: 500 }
      );
    }

    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const userProfile = await resolveUserProfile(supabase as any, user as any);
    const roleCode = String((userProfile?.roles as any)?.role_code || '');
    if (roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only SUPER_ADMIN can connect Google Business' }, { status: 403 });
    }

    const url = new URL(request.url);
    const returnTo = String(url.searchParams.get('return_to') || '/dashboard/super_admin/workshops/public-pages');
    const origin = `${url.protocol}//${url.host}`;
    const redirectUri = `${origin}/api/integrations/google-business/callback`;
    const statePayload = {
      nonce: crypto.randomUUID(),
      t: Date.now(),
      return_to: returnTo,
    };
    const state = Buffer.from(JSON.stringify(statePayload), 'utf8').toString('base64url');

    const scopes = [
      'https://www.googleapis.com/auth/business.manage',
    ].join(' ');

    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', scopes);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');
    googleAuthUrl.searchParams.set('include_granted_scopes', 'true');
    googleAuthUrl.searchParams.set('state', state);

    const response = NextResponse.redirect(googleAuthUrl.toString());
    response.cookies.set('gbp_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 10,
    });
    return response;
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to start Google OAuth', details: e?.message }, { status: 500 });
  }
}

