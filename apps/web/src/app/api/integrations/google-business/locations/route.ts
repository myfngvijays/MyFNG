import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type GbpLocation = {
  resource_name: string;
  title: string;
  address: string;
  place_id: string;
  maps_uri: string;
  website_uri: string;
  phone_number: string;
};

type LocationCacheItem = {
  fetchedAt: number;
  locations: GbpLocation[];
};

const LOCATION_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const locationCache = new Map<string, LocationCacheItem>();

async function readSettings(admin: any, keys: string[]) {
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

async function upsertSetting(admin: any, key: string, value: string) {
  // Atomic upsert prevents duplicate-key race when multiple requests
  // try to refresh/update token settings simultaneously.
  const { error } = await admin.from('system_settings').upsert(
    {
      setting_key: key,
      setting_value: value,
      setting_type: 'STRING',
      category: 'INTEGRATIONS',
      description: 'Google Business integration value',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' }
  );
  if (error) throw error;
}

async function refreshAccessTokenIfNeeded(admin: any): Promise<string> {
  const settings = await readSettings(admin, [
    'google_business_access_token',
    'google_business_refresh_token',
    'google_business_token_expiry',
  ]);

  const currentAccessToken = settings.get('google_business_access_token') || '';
  const refreshToken = settings.get('google_business_refresh_token') || '';
  const expiry = settings.get('google_business_token_expiry') || '';
  const expiryMs = expiry ? new Date(expiry).getTime() : 0;
  const now = Date.now();

  // Use current token if it is still valid for at least 60 seconds.
  if (currentAccessToken && (!expiryMs || now < expiryMs - 60_000)) {
    return currentAccessToken;
  }
  if (!refreshToken) throw new Error('Google Business is not connected');

  const clientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    '';
  const clientSecret =
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    '';
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth client credentials are missing');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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

  const tokenJson: any = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenJson?.access_token) {
    throw new Error(tokenJson?.error_description || tokenJson?.error || 'Failed to refresh Google token');
  }

  const nextAccessToken = String(tokenJson.access_token);
  const expiresIn = Number(tokenJson.expires_in || 3600);
  const nextExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();
  await upsertSetting(admin, 'google_business_access_token', nextAccessToken);
  await upsertSetting(admin, 'google_business_token_expiry', nextExpiry);
  return nextAccessToken;
}

function formatAddress(loc: any) {
  const addr = loc?.storefrontAddress || {};
  const lines = Array.isArray(addr?.addressLines) ? addr.addressLines : [];
  return [
    ...lines,
    addr?.locality,
    addr?.administrativeArea,
    addr?.postalCode,
    addr?.regionCode,
  ]
    .filter(Boolean)
    .join(', ');
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(supabase as any, user as any);
    const roleCode = String((profile?.roles as any)?.role_code || '');
    if (!new Set(['SUPER_ADMIN', 'SUB_ADMIN']).has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cached = locationCache.get(user.id);
    if (cached && Date.now() - cached.fetchedAt < LOCATION_CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        count: cached.locations.length,
        locations: cached.locations,
        cached: true,
      });
    }

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminErr || 'Admin client unavailable' }, { status: 500 });
    }

    const accessToken = await refreshAccessTokenIfNeeded(supabaseAdmin);
    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

    const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: authHeaders,
      cache: 'no-store',
    });
    const accountsJson: any = await accountsRes.json().catch(() => ({}));
    if (!accountsRes.ok) {
      const details = String(accountsJson?.error?.message || 'accounts_fetch_failed');
      const quotaExceeded = /quota/i.test(details) || Number(accountsJson?.error?.code) === 429;
      if (quotaExceeded && cached) {
        return NextResponse.json({
          success: true,
          count: cached.locations.length,
          locations: cached.locations,
          cached: true,
          warning: 'Google quota exceeded. Showing cached locations.',
        });
      }
      return NextResponse.json(
        {
          error: 'Failed to read Google Business accounts',
          google_status: accountsJson?.error?.status || null,
          google_code: accountsJson?.error?.code || null,
          details,
        },
        { status: 502 }
      );
    }

    const accounts: any[] = Array.isArray(accountsJson?.accounts) ? accountsJson.accounts : [];
    const allLocations: GbpLocation[] = [];

    for (const acc of accounts) {
      const accountName = String(acc?.name || '').trim(); // accounts/123
      if (!accountName) continue;

      const locUrl = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`);
      locUrl.searchParams.set(
        'readMask',
        [
          'title',
          'storefrontAddress',
          'phoneNumbers',
          'websiteUri',
          'metadata',
          'regularHours',
        ].join(',')
      );
      locUrl.searchParams.set('pageSize', '100');

      const locRes = await fetch(locUrl.toString(), {
        headers: authHeaders,
        cache: 'no-store',
      });
      const locJson: any = await locRes.json().catch(() => ({}));
      if (!locRes.ok) continue;
      const locations: any[] = Array.isArray(locJson?.locations) ? locJson.locations : [];

      for (const loc of locations) {
        allLocations.push({
          resource_name: String(loc?.name || ''), // accounts/{a}/locations/{l}
          title: String(loc?.title || ''),
          address: formatAddress(loc),
          place_id: String(loc?.metadata?.placeId || ''),
          maps_uri: String(loc?.metadata?.mapsUri || ''),
          website_uri: String(loc?.websiteUri || ''),
          phone_number: String(loc?.phoneNumbers?.primaryPhone || ''),
        });
      }
    }

    const uniq = new Map<string, GbpLocation>();
    for (const item of allLocations) {
      const key = item.place_id || item.resource_name;
      if (!key) continue;
      if (!uniq.has(key)) uniq.set(key, item);
    }

    const locations = Array.from(uniq.values()).sort((a, b) => a.title.localeCompare(b.title));
    locationCache.set(user.id, { fetchedAt: Date.now(), locations });
    return NextResponse.json({ success: true, count: locations.length, locations });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Failed to fetch Google Business locations', details: e?.message || 'unknown_error' },
      { status: 500 }
    );
  }
}

