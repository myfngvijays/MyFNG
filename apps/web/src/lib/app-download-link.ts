import {
  DEFAULT_APP_STORE_URL,
  DEFAULT_PLAY_STORE_URL,
  getMobileAppVersionConfig,
} from '@/lib/mobile-app-version-config';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { mergeUtmParams, parseUtmParams, type UtmParams } from '@/lib/utm';
import {
  MYFNG_APP_DOWNLOAD_SLUG,
  MYFNG_APP_DOWNLOAD_SLUGS,
  MYFNG_APP_DOWNLOAD_URL,
} from '@/shared/constants/appDownload';

export { MYFNG_APP_DOWNLOAD_SLUG, MYFNG_APP_DOWNLOAD_URL };

export const APP_DOWNLOAD_SLUGS = new Set<string>(MYFNG_APP_DOWNLOAD_SLUGS);

export type AppDownloadPlatform = 'ios' | 'android' | 'desktop';

export function isAppDownloadSlug(slug: string): boolean {
  return APP_DOWNLOAD_SLUGS.has(String(slug || '').trim().toLowerCase());
}

export function detectAppDownloadPlatform(userAgent: string): AppDownloadPlatform {
  const ua = String(userAgent || '').toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

export function parseUtmFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): UtmParams {
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(searchParams || {})) {
    if (Array.isArray(raw)) {
      if (raw[0]) query.set(key, raw[0]);
    } else if (raw) {
      query.set(key, raw);
    }
  }
  return parseUtmParams(query.toString() ? `?${query.toString()}` : '');
}

export async function getAppStoreUrls(): Promise<{ ios: string; android: string }> {
  try {
    const config = await getMobileAppVersionConfig();
    return {
      ios: config.app_store_url || DEFAULT_APP_STORE_URL,
      android: config.play_store_url || DEFAULT_PLAY_STORE_URL,
    };
  } catch {
    return {
      ios: DEFAULT_APP_STORE_URL,
      android: DEFAULT_PLAY_STORE_URL,
    };
  }
}

function appendPlayStoreReferrer(baseUrl: string, utm: UtmParams): string {
  const parts: string[] = [];
  if (utm.utm_source) parts.push(`utm_source=${encodeURIComponent(utm.utm_source)}`);
  if (utm.utm_medium) parts.push(`utm_medium=${encodeURIComponent(utm.utm_medium)}`);
  if (utm.utm_campaign) parts.push(`utm_campaign=${encodeURIComponent(utm.utm_campaign)}`);
  if (utm.utm_term) parts.push(`utm_term=${encodeURIComponent(utm.utm_term)}`);
  if (utm.utm_content) parts.push(`utm_content=${encodeURIComponent(utm.utm_content)}`);
  if (parts.length === 0) return baseUrl;

  const referrer = encodeURIComponent(parts.join('&'));
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}referrer=${referrer}`;
}

export async function buildAppDownloadRedirectUrl(
  platform: Exclude<AppDownloadPlatform, 'desktop'>,
  utm: UtmParams = {},
): Promise<string> {
  const stores = await getAppStoreUrls();
  if (platform === 'ios') return stores.ios;
  return appendPlayStoreReferrer(stores.android, utm);
}

function buildClickDedupeKey(input: {
  slug: string;
  platform: AppDownloadPlatform;
  utm?: UtmParams;
  userAgent?: string | null;
  referer?: string | null;
  source?: string | null;
}): string {
  return [
    input.slug,
    input.platform,
    input.source || 'go_redirect',
    input.utm?.utm_source || '',
    input.utm?.utm_medium || '',
    input.utm?.utm_campaign || '',
    input.utm?.utm_term || '',
    input.utm?.utm_content || '',
    String(input.userAgent || '').slice(0, 120),
    String(input.referer || '').slice(0, 200),
  ].join('|');
}

async function hasRecentDuplicateClick(
  supabaseAdmin: NonNullable<ReturnType<typeof getSupabaseAdmin>['supabaseAdmin']>,
  dedupeKey: string,
  windowMs = 5000,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await supabaseAdmin
    .from('customer_analytics_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_name', 'app_download_link_click')
    .gte('created_at', since)
    .filter('properties->>dedupe_key', 'eq', dedupeKey);

  if (error) {
    console.warn('[app-download-link] dedupe check failed:', error.message);
    return false;
  }
  return (count || 0) > 0;
}

export async function logAppDownloadLinkClick(input: {
  slug: string;
  platform: AppDownloadPlatform;
  utm?: UtmParams;
  userAgent?: string | null;
  referer?: string | null;
  redirectUrl?: string | null;
  source?: string | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return;

    let refererUtm: UtmParams = {};
    try {
      if (input.referer) refererUtm = parseUtmParams(new URL(String(input.referer)).search);
    } catch {
      refererUtm = {};
    }
    const utm = mergeUtmParams(refererUtm, input.utm);

    const dedupeKey = buildClickDedupeKey({ ...input, utm });
    if (await hasRecentDuplicateClick(supabaseAdmin, dedupeKey)) return;

    await supabaseAdmin.from('customer_analytics_events').insert({
      customer_id: null,
      event_name: 'app_download_link_click',
      event_group: 'marketing',
      properties: {
        slug: input.slug,
        platform: input.platform,
        redirect_url: input.redirectUrl || null,
        source: input.source || 'go_redirect',
        dedupe_key: dedupeKey,
        user_agent: input.userAgent ? String(input.userAgent).slice(0, 500) : null,
        referer: input.referer ? String(input.referer).slice(0, 500) : null,
        ...utm,
      },
    });
  } catch (err) {
    console.warn('[app-download-link] click log failed:', err);
  }
}
