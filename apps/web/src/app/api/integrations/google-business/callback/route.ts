import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getOAuthConfig() {
  const clientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    '';
  const clientSecret =
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    '';
  return { clientId, clientSecret };
}

function safeReturnTo(input: string | null) {
  const value = String(input || '/dashboard/super_admin/workshops/public-pages').trim();
  if (!value.startsWith('/')) return '/dashboard/super_admin/workshops/public-pages';
  if (value.startsWith('//')) return '/dashboard/super_admin/workshops/public-pages';
  return value;
}

async function upsertSetting(supabase: any, row: {
  setting_key: string;
  setting_value: string;
  setting_type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'DATE';
  category: string;
  description: string;
  updated_by: string;
}) {
  const { error: updateError, count } = await supabase
    .from('system_settings')
    .update({
      setting_value: row.setting_value,
      setting_type: row.setting_type,
      category: row.category,
      description: row.description,
      updated_by: row.updated_by,
      updated_at: new Date().toISOString(),
    })
    .eq('setting_key', row.setting_key)
    .select('id', { count: 'exact', head: true });

  if (updateError) throw updateError;
  if ((count || 0) > 0) return;

  const { error: insertError } = await supabase.from('system_settings').insert({
    setting_key: row.setting_key,
    setting_value: row.setting_value,
    setting_type: row.setting_type,
    category: row.category,
    description: row.description,
    updated_by: row.updated_by,
  });
  if (insertError) throw insertError;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get('code') || '').trim();
  const state = String(url.searchParams.get('state') || '').trim();
  const stateCookie = request.cookies.get('gbp_oauth_state')?.value || '';
  const errorParam = String(url.searchParams.get('error') || '').trim();

  let returnTo = '/dashboard/super_admin/workshops/public-pages';
  try {
    if (state) {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      returnTo = safeReturnTo(parsed?.return_to || null);
    }
  } catch {
    returnTo = '/dashboard/super_admin/workshops/public-pages';
  }

  const responseBase = new URL(returnTo, request.url);

  if (errorParam) {
    responseBase.searchParams.set('gmb_connect', 'error');
    responseBase.searchParams.set('msg', errorParam);
    const res = NextResponse.redirect(responseBase);
    res.cookies.delete('gbp_oauth_state');
    return res;
  }

  if (!code || !state || !stateCookie || state !== stateCookie) {
    responseBase.searchParams.set('gmb_connect', 'error');
    responseBase.searchParams.set('msg', 'invalid_state');
    const res = NextResponse.redirect(responseBase);
    res.cookies.delete('gbp_oauth_state');
    return res;
  }

  try {
    const { clientId, clientSecret } = getOAuthConfig();
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth client credentials missing');
    }

    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      responseBase.searchParams.set('gmb_connect', 'error');
      responseBase.searchParams.set('msg', 'unauthorized');
      const res = NextResponse.redirect(responseBase);
      res.cookies.delete('gbp_oauth_state');
      return res;
    }

    const userProfile = await resolveUserProfile(supabase as any, user as any);
    const roleCode = String((userProfile?.roles as any)?.role_code || '');
    if (roleCode !== 'SUPER_ADMIN') {
      responseBase.searchParams.set('gmb_connect', 'error');
      responseBase.searchParams.set('msg', 'forbidden');
      const res = NextResponse.redirect(responseBase);
      res.cookies.delete('gbp_oauth_state');
      return res;
    }

    const origin = `${url.protocol}//${url.host}`;
    const redirectUri = `${origin}/api/integrations/google-business/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    const tokenJson: any = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok) {
      throw new Error(tokenJson?.error_description || tokenJson?.error || 'token_exchange_failed');
    }

    const accessToken = String(tokenJson?.access_token || '').trim();
    const refreshToken = String(tokenJson?.refresh_token || '').trim();
    const expiresIn = Number(tokenJson?.expires_in || 0);
    const expiryIso = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : '';

    if (!accessToken) throw new Error('No access token returned by Google');

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) throw new Error(adminError || 'Supabase admin client not configured');

    await upsertSetting(supabaseAdmin, {
      setting_key: 'google_business_access_token',
      setting_value: accessToken,
      setting_type: 'STRING',
      category: 'INTEGRATIONS',
      description: 'Google Business Profile OAuth access token',
      updated_by: user.id,
    });

    if (refreshToken) {
      await upsertSetting(supabaseAdmin, {
        setting_key: 'google_business_refresh_token',
        setting_value: refreshToken,
        setting_type: 'STRING',
        category: 'INTEGRATIONS',
        description: 'Google Business Profile OAuth refresh token',
        updated_by: user.id,
      });
    }

    if (expiryIso) {
      await upsertSetting(supabaseAdmin, {
        setting_key: 'google_business_token_expiry',
        setting_value: expiryIso,
        setting_type: 'DATE',
        category: 'INTEGRATIONS',
        description: 'Google Business Profile access token expiry (ISO)',
        updated_by: user.id,
      });
    }

    await upsertSetting(supabaseAdmin, {
      setting_key: 'google_business_connected_at',
      setting_value: new Date().toISOString(),
      setting_type: 'DATE',
      category: 'INTEGRATIONS',
      description: 'Timestamp when Google Business was connected',
      updated_by: user.id,
    });

    responseBase.searchParams.set('gmb_connect', 'success');
    const res = NextResponse.redirect(responseBase);
    res.cookies.delete('gbp_oauth_state');
    return res;
  } catch (e: any) {
    responseBase.searchParams.set('gmb_connect', 'error');
    responseBase.searchParams.set('msg', String(e?.message || 'oauth_failed').slice(0, 120));
    const res = NextResponse.redirect(responseBase);
    res.cookies.delete('gbp_oauth_state');
    return res;
  }
}

