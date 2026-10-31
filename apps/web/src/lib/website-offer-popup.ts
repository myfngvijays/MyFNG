import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export type WebsiteOfferPopupConfig = {
  enabled: boolean;
  starts_at: string;
  ends_at: string;
  headline: string;
  subtitle: string;
  coupon_code: string;
  offer_label: string;
  badge_text: string;
  button_text: string;
  button_href: string;
  image_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  max_views: number;
};

export const DEFAULT_WEBSITE_OFFER_POPUP: WebsiteOfferPopupConfig = {
  enabled: true,
  starts_at: '2026-10-31T00:00',
  ends_at: '2026-11-07T15:57',
  headline: 'Flat 20% OFF',
  subtitle: 'Use code on car periodic service',
  coupon_code: 'DIWALI20',
  offer_label: '20% OFF',
  badge_text: 'LIMITED TIME OFFER',
  button_text: 'Book Service',
  button_href: '/book-service',
  image_url: '/media/banners/myfng-diwali-car-service-offer-1600x800.webp',
  utm_source: 'popup',
  utm_medium: 'diwali',
  utm_campaign: 'diwali20',
  max_views: 2,
};

const SETTING_KEY = 'website_offer_popup';

function text(value: unknown, fallback: string, maxLen: number) {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return fallback;
  return raw.slice(0, maxLen);
}

function href(value: unknown, fallback: string) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw.slice(0, 300);
  if (/^https:\/\/[^\s]+$/i.test(raw)) return raw.slice(0, 300);
  return fallback;
}

function localDateTime(value: unknown, fallback: string) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return fallback;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

export function normalizeWebsiteOfferPopup(input?: Partial<WebsiteOfferPopupConfig> | null): WebsiteOfferPopupConfig {
  const base = DEFAULT_WEBSITE_OFFER_POPUP;
  const views = Number(input?.max_views);
  return {
    enabled: input?.enabled !== false,
    starts_at: localDateTime(input?.starts_at, base.starts_at),
    ends_at: localDateTime(input?.ends_at, base.ends_at),
    headline: text(input?.headline, base.headline, 80),
    subtitle: text(input?.subtitle, base.subtitle, 140),
    coupon_code: text(input?.coupon_code, base.coupon_code, 32).toUpperCase(),
    offer_label: text(input?.offer_label, base.offer_label, 24),
    badge_text: text(input?.badge_text, base.badge_text, 40),
    button_text: text(input?.button_text, base.button_text, 40),
    button_href: href(input?.button_href, base.button_href),
    image_url: href(input?.image_url, base.image_url),
    utm_source: text(input?.utm_source, base.utm_source, 40).toLowerCase(),
    utm_medium: text(input?.utm_medium, base.utm_medium, 40).toLowerCase(),
    utm_campaign: text(input?.utm_campaign, base.utm_campaign, 60).toLowerCase(),
    max_views: Number.isFinite(views) && views > 0 ? Math.min(Math.round(views), 20) : base.max_views,
  };
}

export function isWebsiteOfferPopupLive(config: WebsiteOfferPopupConfig, now = new Date()) {
  if (!config.enabled) return false;
  if (config.starts_at && new Date(config.starts_at).getTime() > now.getTime()) return false;
  if (config.ends_at && new Date(config.ends_at).getTime() < now.getTime()) return false;
  return true;
}

export function websiteOfferPopupHref(config: WebsiteOfferPopupConfig) {
  const params = new URLSearchParams({
    utm_source: config.utm_source || 'popup',
    utm_medium: config.utm_medium || 'diwali',
    utm_campaign: config.utm_campaign || 'diwali20',
    utm_content: 'website-popup',
  });
  const path = config.button_href || '/book-service';
  return `${path}${path.includes('?') ? '&' : '?'}${params.toString()}`;
}

export async function getWebsiteOfferPopup(): Promise<WebsiteOfferPopupConfig> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return DEFAULT_WEBSITE_OFFER_POPUP;
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', SETTING_KEY)
    .maybeSingle();
  const raw = String((data as { setting_value?: string } | null)?.setting_value || '').trim();
  if (!raw) return DEFAULT_WEBSITE_OFFER_POPUP;
  try {
    return normalizeWebsiteOfferPopup(JSON.parse(raw));
  } catch {
    return DEFAULT_WEBSITE_OFFER_POPUP;
  }
}

export async function saveWebsiteOfferPopup(config: WebsiteOfferPopupConfig, userId?: string | null) {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Admin client unavailable');
  const next = normalizeWebsiteOfferPopup(config);
  const { error: upErr } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: SETTING_KEY,
      setting_value: JSON.stringify(next),
      setting_type: 'JSON',
      category: 'SYSTEM',
      description: 'Website Diwali offer popup',
      is_editable: true,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  if (upErr) throw new Error(upErr.message);
  return next;
}
