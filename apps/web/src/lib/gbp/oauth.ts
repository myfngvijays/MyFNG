import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

async function readGbpSettings(admin: any, keys: string[]) {
  const { data, error } = await admin
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', keys);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data || []) {
    map.set(String((row as any).setting_key), String((row as any).setting_value || ''));
  }
  return map;
}

async function upsertGbpSetting(admin: any, key: string, value: string) {
  const { error } = await admin.from('system_settings').upsert(
    {
      setting_key: key,
      setting_value: value,
      setting_type: 'STRING',
      category: 'INTEGRATIONS',
      description: 'Google Business integration value',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  if (error) throw error;
}

export type GbpAuthResult = {
  accessToken: string | null;
  hasRefreshToken: boolean;
  reason?: string;
};

/** Fresh Google Business Profile OAuth access token (refreshes if needed). */
export async function getGbpAccessTokenDetailed(): Promise<GbpAuthResult> {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return { accessToken: null, hasRefreshToken: false, reason: 'admin_client_missing' };
    }

    const settings = await readGbpSettings(supabaseAdmin, [
      'google_business_access_token',
      'google_business_refresh_token',
      'google_business_token_expiry',
    ]);

    const currentToken = settings.get('google_business_access_token') || '';
    const refreshToken = settings.get('google_business_refresh_token') || '';
    const expiry = settings.get('google_business_token_expiry') || '';
    const expiryMs = expiry ? new Date(expiry).getTime() : 0;

    if (currentToken && (!expiryMs || Date.now() < expiryMs - 60_000)) {
      return { accessToken: currentToken, hasRefreshToken: Boolean(refreshToken) };
    }
    if (!refreshToken) {
      return { accessToken: null, hasRefreshToken: false, reason: 'not_connected' };
    }

    const clientId =
      process.env.GOOGLE_OAUTH_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      '';
    const clientSecret =
      process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
    if (!clientId || !clientSecret) {
      return {
        accessToken: currentToken || null,
        hasRefreshToken: true,
        reason: 'oauth_client_credentials_missing',
      };
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
      cache: 'no-store',
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      // Expired access token may still work briefly; otherwise reconnect needed
      if (currentToken) {
        return {
          accessToken: currentToken,
          hasRefreshToken: true,
          reason: `refresh_failed_using_old_token:${tokenJson?.error || tokenRes.status}`,
        };
      }
      return {
        accessToken: null,
        hasRefreshToken: true,
        reason: `refresh_failed:${tokenJson?.error_description || tokenJson?.error || tokenRes.status}`,
      };
    }

    const nextToken = String(tokenJson.access_token);
    const expiresIn = Number(tokenJson.expires_in || 3600);
    const nextExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();
    await upsertGbpSetting(supabaseAdmin, 'google_business_access_token', nextToken);
    await upsertGbpSetting(supabaseAdmin, 'google_business_token_expiry', nextExpiry);
    return { accessToken: nextToken, hasRefreshToken: true };
  } catch (e: any) {
    return {
      accessToken: null,
      hasRefreshToken: false,
      reason: e?.message || 'auth_exception',
    };
  }
}

export async function getGbpAccessToken(): Promise<string | null> {
  const result = await getGbpAccessTokenDetailed();
  return result.accessToken;
}

export async function upsertSystemSetting(admin: any, key: string, value: string, description?: string) {
  await admin.from('system_settings').upsert(
    {
      setting_key: key,
      setting_value: value,
      setting_type: 'STRING',
      category: 'INTEGRATIONS',
      description: description || 'System setting',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
}

export async function readSystemSetting(admin: any, key: string): Promise<string> {
  const { data } = await admin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .maybeSingle();
  return String(data?.setting_value || '');
}
