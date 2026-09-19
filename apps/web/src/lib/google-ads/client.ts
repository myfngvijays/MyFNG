import { getGoogleAdsSettings, normalizeAdsCustomerId, type GoogleAdsSettings } from './settings';

const API_VERSIONS = ['v25', 'v24', 'v23', 'v22'] as const;
const ADWORDS_SCOPE = 'https://www.googleapis.com/auth/adwords';

export { ADWORDS_SCOPE };

type SearchRow = Record<string, any>;

async function refreshAccessToken(settings: GoogleAdsSettings): Promise<string> {
  if (!settings.refreshToken) {
    throw new Error('Google Ads is not connected. Super Admin → Google Ads → Connect with Google (Ads scope).');
  }
  if (!settings.clientId || !settings.clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are missing.');
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      refresh_token: settings.refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `Google OAuth refresh failed (${res.status})`);
  }
  return json.access_token;
}

function adsHeaders(settings: GoogleAdsSettings, accessToken: string, withLoginCustomer: boolean): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': settings.developerToken,
    'Content-Type': 'application/json',
  };
  if (withLoginCustomer && settings.loginCustomerId) headers['login-customer-id'] = settings.loginCustomerId;
  return headers;
}

function adsErrorMessage(json: any, status: number): string {
  const failure = Array.isArray(json?.error?.details)
    ? json.error.details.find((d: any) => Array.isArray(d?.errors)) || json.error.details[0]
    : null;
  const first = Array.isArray(failure?.errors) ? failure.errors[0] : null;
  const fromAds = first?.message || (first?.errorCode ? JSON.stringify(first.errorCode) : '');
  return String(fromAds || json?.error?.message || json?.error?.status || `Google Ads API ${status}`);
}

async function adsFetch(
  settings: GoogleAdsSettings,
  accessToken: string,
  path: string,
  init?: RequestInit & { skipLoginCustomer?: boolean },
): Promise<any> {
  const { skipLoginCustomer, ...req } = init || {};
  let lastError = 'Google Ads API request failed';
  for (const version of API_VERSIONS) {
    const url = `https://googleads.googleapis.com/${version}${path}`;
    const res = await fetch(url, {
      ...req,
      headers: {
        ...adsHeaders(settings, accessToken, !skipLoginCustomer),
        ...(req.headers || {}),
      },
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return json;
    lastError = adsErrorMessage(json, res.status);
    if (res.status !== 404 && !/version|not found/i.test(lastError)) {
      throw new Error(lastError);
    }
  }
  throw new Error(lastError);
}

export async function googleAdsSearch(query: string, customerId?: string): Promise<SearchRow[]> {
  const settings = await getGoogleAdsSettings();
  if (!settings.developerToken) throw new Error('Google Ads developer token is missing.');
  const cid = normalizeAdsCustomerId(customerId || settings.customerId);
  if (!cid) throw new Error('Google Ads customer ID is missing.');
  const accessToken = await refreshAccessToken(settings);
  const json = await adsFetch(settings, accessToken, `/customers/${cid}/googleAds:search`, {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
  return Array.isArray(json?.results) ? json.results : [];
}

export async function listAccessibleCustomerIds(): Promise<string[]> {
  const settings = await getGoogleAdsSettings();
  if (!settings.developerToken) throw new Error('Google Ads developer token is missing.');
  const accessToken = await refreshAccessToken(settings);
  const json = await adsFetch(settings, accessToken, '/customers:listAccessibleCustomers', {
    method: 'GET',
    skipLoginCustomer: true,
  });
  return (Array.isArray(json?.resourceNames) ? json.resourceNames : [])
    .map((name: string) => String(name || '').replace(/^customers\//, ''))
    .filter(Boolean);
}

export function microsToAmount(value: unknown): number {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n / 1_000_000) * 100) / 100;
}
