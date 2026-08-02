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

export async function logAppDownloadLinkClick(input: {
  slug: string;
  platform: AppDownloadPlatform;
  utm?: UtmParams;
  userAgent?: string | null;
  referer?: string | null;
  redirectUrl?: string | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return;

    await supabaseAdmin.from('customer_analytics_events').insert({
      customer_id: null,
      event_name: 'app_download_link_click',
      event_group: 'marketing',
      properties: {
        slug: input.slug,
        platform: input.platform,
        redirect_url: input.redirectUrl || null,
        user_agent: input.userAgent ? String(input.userAgent).slice(0, 500) : null,
        referer: input.referer ? String(input.referer).slice(0, 500) : null,
        ...mergeUtmParams(input.utm),
      },
    });
  } catch (err) {
    console.warn('[app-download-link] click log failed:', err);
  }
}
