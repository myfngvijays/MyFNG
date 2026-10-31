import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const WEBSITE_POPUP_IMAGE = {
  width: 1600,
  height: 800,
  label: '1600 × 800 px',
  ratio: '2:1',
};

export type WebsitePopupColors = {
  card: string;
  headline: string;
  subtitle: string;
  code_bg: string;
  code_text: string;
  offer_bg: string;
  offer_text: string;
  badge_bg: string;
  badge_text: string;
  button_bg: string;
  button_text: string;
  ring: string;
};

export type WebsiteOfferPopupConfig = {
  id: string;
  name: string;
  enabled: boolean;
  starts_at: string;
  ends_at: string;
  pages: string[];
  headline: string;
  subtitle: string;
  coupon_code: string;
  offer_label: string;
  badge_text: string;
  button_text: string;
  button_href: string;
  image_url: string;
  colors: WebsitePopupColors;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  max_views: number;
};

export const WEBSITE_POPUP_PAGE_OPTIONS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'all', label: 'All public pages', hint: 'Except book service, unless that box is ticked too' },
  { id: 'home', label: 'Home', hint: '/' },
  { id: 'services', label: 'Services', hint: '/services' },
  { id: 'car-services', label: 'Car service pages', hint: '/car-services' },
  { id: 'cities', label: 'City pages', hint: '/car-service-in' },
  { id: 'workshops', label: 'Workshop pages', hint: '/workshop' },
  { id: 'blogs', label: 'Blogs & news', hint: '/blogs' },
  { id: 'about', label: 'About', hint: '/about' },
  { id: 'contact', label: 'Contact', hint: '/contact' },
  { id: 'faq', label: 'FAQ', hint: '/faq' },
  { id: 'rsa', label: 'Roadside assistance', hint: '/roadside-assistance' },
  { id: 'pricing', label: 'Pricing', hint: '/pricing' },
  { id: 'brands', label: 'Popular brands', hint: '/popular-brands' },
  { id: 'ads', label: 'Ads & campaign pages', hint: '/car-service-and-repairs' },
  { id: 'book', label: 'Book service', hint: '/book-service' },
  { id: 'other', label: 'Other public pages', hint: 'Any page not listed above' },
];

export const WEBSITE_POPUP_BUTTON_PAGES: Array<{ label: string; href: string }> = [
  { label: 'Book service', href: '/book-service' },
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'Car services', href: '/car-services' },
  { label: 'Workshop locator', href: '/workshop-locator' },
  { label: 'Blogs', href: '/blogs' },
  { label: 'About us', href: '/about-us' },
  { label: 'Contact us', href: '/contact-us' },
  { label: 'FAQ', href: '/faqs' },
  { label: 'Roadside assistance', href: '/roadside-assistance' },
  { label: 'Popular brands', href: '/popular-brands' },
  { label: 'Ads landing', href: '/car-service-and-repairs' },
  { label: 'Car loan', href: '/car-loan' },
];

const PAGE_IDS = new Set(WEBSITE_POPUP_PAGE_OPTIONS.map((page) => page.id));

const PAGE_RULES: Array<{ id: string; test: (path: string) => boolean }> = [
  { id: 'book', test: (path) => path === '/book-service' || path.startsWith('/book-service/') },
  { id: 'home', test: (path) => path === '/' },
  { id: 'services', test: (path) => path === '/services' || path.startsWith('/services/') },
  { id: 'car-services', test: (path) => path === '/car-services' || path.startsWith('/car-services/') },
  { id: 'cities', test: (path) => path.startsWith('/car-service-in/') },
  { id: 'workshops', test: (path) => path.startsWith('/workshop/') || path === '/workshop-locator' },
  {
    id: 'blogs',
    test: (path) =>
      path === '/blog' ||
      path.startsWith('/blog/') ||
      path === '/blogs' ||
      path.startsWith('/blogs/') ||
      path.startsWith('/automobile-news'),
  },
  { id: 'about', test: (path) => path === '/about' || path === '/about-us' },
  { id: 'contact', test: (path) => path === '/contact' || path === '/contact-us' },
  { id: 'faq', test: (path) => path === '/faq' || path === '/faqs' },
  {
    id: 'rsa',
    test: (path) =>
      path.startsWith('/roadside-assistance') ||
      path.startsWith('/car-roadside-assistance') ||
      path === '/rsa_landing',
  },
  { id: 'pricing', test: (path) => path === '/pricing' || path.startsWith('/pricing/') },
  { id: 'brands', test: (path) => path.startsWith('/popular-brands') },
  { id: 'ads', test: (path) => path.startsWith('/car-service-and-repairs') || path.startsWith('/p/') },
];

export const DEFAULT_WEBSITE_POPUP_COLORS: WebsitePopupColors = {
  card: '#fff8ef',
  headline: '#5c1020',
  subtitle: '#c2410c',
  code_bg: '#6b1224',
  code_text: '#ffe14a',
  offer_bg: '#ffd000',
  offer_text: '#7a1020',
  badge_bg: '#ffe7a3',
  badge_text: '#9a3412',
  button_bg: '#6b1224',
  button_text: '#ffe14a',
  ring: '#e7c27a',
};

export const DEFAULT_WEBSITE_OFFER_POPUP: WebsiteOfferPopupConfig = {
  id: 'popup-1',
  name: 'Diwali offer',
  enabled: true,
  starts_at: '2026-10-31T00:00',
  ends_at: '2026-11-07T15:57',
  pages: ['home', 'services', 'car-services'],
  headline: 'Flat 20% OFF',
  subtitle: 'Use code on car periodic service',
  coupon_code: 'DIWALI20',
  offer_label: '20% OFF',
  badge_text: 'LIMITED TIME OFFER',
  button_text: 'Book Service',
  button_href: '/book-service',
  image_url: '/media/banners/myfng-diwali-car-service-offer-1600x800.webp',
  colors: DEFAULT_WEBSITE_POPUP_COLORS,
  utm_source: 'popup',
  utm_medium: 'diwali',
  utm_campaign: 'diwali20',
  max_views: 2,
};

const SETTING_KEY = 'website_offer_popup';
const MAX_POPUPS = 12;

function text(value: unknown, fallback: string, maxLen: number, allowEmpty = false) {
  if (value == null) return fallback;
  const raw = String(value).replace(/\s+/g, ' ').trim();
  if (!raw) return allowEmpty ? '' : fallback;
  return raw.slice(0, maxLen);
}

function href(value: unknown, fallback: string) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw.slice(0, 300);
  if (/^https:\/\/[^\s]+$/i.test(raw)) return raw.slice(0, 300);
  return fallback;
}

function imageUrl(value: unknown, fallback: string) {
  if (value == null) return fallback;
  const raw = String(value).trim();
  if (!raw) return '';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw.slice(0, 400);
  if (/^https:\/\/[^\s]+$/i.test(raw)) return raw.slice(0, 400);
  return fallback;
}

function color(value: unknown, fallback: string) {
  const raw = String(value ?? '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  return fallback;
}

function localDateTime(value: unknown, fallback: string) {
  if (value == null) return fallback;
  const raw = String(value).trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return fallback;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function pagesOf(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  return [...new Set(value.map((item) => String(item || '').trim()).filter((id) => PAGE_IDS.has(id)))];
}

export function normalizeWebsiteOfferPopup(
  input?: Partial<WebsiteOfferPopupConfig> | null,
  index = 0,
): WebsiteOfferPopupConfig {
  const base = DEFAULT_WEBSITE_OFFER_POPUP;
  const views = Number(input?.max_views);
  const colors = input?.colors || {};
  const id = text(input?.id, `popup-${index + 1}`, 40).replace(/[^a-zA-Z0-9_-]/g, '') || `popup-${index + 1}`;
  return {
    id,
    name: text(input?.name, index === 0 ? base.name : `Popup ${index + 1}`, 60),
    enabled: input?.enabled !== false,
    starts_at: localDateTime(input?.starts_at, base.starts_at),
    ends_at: localDateTime(input?.ends_at, base.ends_at),
    pages: pagesOf(input?.pages, base.pages),
    headline: text(input?.headline, base.headline, 80),
    subtitle: text(input?.subtitle, base.subtitle, 140, true),
    coupon_code: text(input?.coupon_code, '', 32, true).toUpperCase(),
    offer_label: text(input?.offer_label, '', 24, true),
    badge_text: text(input?.badge_text, '', 40, true),
    button_text: text(input?.button_text, base.button_text, 40),
    button_href: href(input?.button_href, base.button_href),
    image_url: imageUrl(input?.image_url, base.image_url),
    colors: {
      card: color(colors.card, base.colors.card),
      headline: color(colors.headline, base.colors.headline),
      subtitle: color(colors.subtitle, base.colors.subtitle),
      code_bg: color(colors.code_bg, base.colors.code_bg),
      code_text: color(colors.code_text, base.colors.code_text),
      offer_bg: color(colors.offer_bg, base.colors.offer_bg),
      offer_text: color(colors.offer_text, base.colors.offer_text),
      badge_bg: color(colors.badge_bg, base.colors.badge_bg),
      badge_text: color(colors.badge_text, base.colors.badge_text),
      button_bg: color(colors.button_bg, base.colors.button_bg),
      button_text: color(colors.button_text, base.colors.button_text),
      ring: color(colors.ring, base.colors.ring),
    },
    utm_source: text(input?.utm_source, base.utm_source, 40).toLowerCase(),
    utm_medium: text(input?.utm_medium, base.utm_medium, 40).toLowerCase(),
    utm_campaign: text(input?.utm_campaign, base.utm_campaign, 60).toLowerCase(),
    max_views: Number.isFinite(views) && views > 0 ? Math.min(Math.round(views), 20) : base.max_views,
  };
}

export function normalizeWebsiteOfferPopups(input: unknown): WebsiteOfferPopupConfig[] {
  const rows = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  return rows.slice(0, MAX_POPUPS).map((row, index) => {
    const popup = normalizeWebsiteOfferPopup(row, index);
    let id = popup.id;
    if (seen.has(id)) id = `${id}-${index + 1}`.slice(0, 40);
    seen.add(id);
    return { ...popup, id };
  });
}

export function isWebsiteOfferPopupLive(config: WebsiteOfferPopupConfig, now = new Date()) {
  if (!config.enabled) return false;
  if (config.starts_at && new Date(config.starts_at).getTime() > now.getTime()) return false;
  if (config.ends_at && new Date(config.ends_at).getTime() < now.getTime()) return false;
  return true;
}

export function websitePopupPageId(pathname: string) {
  const path = String(pathname || '/').split('?')[0] || '/';
  const match = PAGE_RULES.find((rule) => rule.test(path));
  return match?.id || 'other';
}

export function websitePopupMatchesPath(popup: WebsiteOfferPopupConfig, pathname: string) {
  const pages = popup.pages || [];
  if (!pages.length) return false;
  const path = String(pathname || '/').split('?')[0] || '/';
  const isBook = path === '/book-service' || path.startsWith('/book-service/');
  if (pages.includes('all')) {
    if (isBook) return pages.includes('book');
    return true;
  }
  return pages.includes(websitePopupPageId(path));
}

export function pickLiveWebsiteOfferPopup(
  popups: WebsiteOfferPopupConfig[],
  pathname: string,
  now = new Date(),
) {
  return (
    popups.find((popup) => isWebsiteOfferPopupLive(popup, now) && websitePopupMatchesPath(popup, pathname)) ||
    null
  );
}

export function websiteOfferPopupHref(config: WebsiteOfferPopupConfig) {
  const params = new URLSearchParams({
    utm_source: config.utm_source || 'popup',
    utm_medium: config.utm_medium || 'diwali',
    utm_campaign: config.utm_campaign || 'diwali20',
    utm_content: config.id || 'website-popup',
  });
  const path = config.button_href || '/book-service';
  return `${path}${path.includes('?') ? '&' : '?'}${params.toString()}`;
}

function parseStored(raw: string): WebsiteOfferPopupConfig[] {
  if (!raw) return [DEFAULT_WEBSITE_OFFER_POPUP];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.popups)) {
      const popups = normalizeWebsiteOfferPopups(parsed.popups);
      return popups.length ? popups : [DEFAULT_WEBSITE_OFFER_POPUP];
    }
    if (parsed && typeof parsed === 'object') {
      return [normalizeWebsiteOfferPopup(parsed, 0)];
    }
  } catch {
    return [DEFAULT_WEBSITE_OFFER_POPUP];
  }
  return [DEFAULT_WEBSITE_OFFER_POPUP];
}

export async function getWebsiteOfferPopups(): Promise<WebsiteOfferPopupConfig[]> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [DEFAULT_WEBSITE_OFFER_POPUP];
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', SETTING_KEY)
    .maybeSingle();
  return parseStored(String((data as { setting_value?: string } | null)?.setting_value || '').trim());
}

export async function saveWebsiteOfferPopups(popups: unknown, userId?: string | null) {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Admin client unavailable');
  const next = normalizeWebsiteOfferPopups(Array.isArray(popups) ? popups : []);
  if (!next.length) throw new Error('Add at least one popup');
  const { error: upErr } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: SETTING_KEY,
      setting_value: JSON.stringify({ popups: next }),
      setting_type: 'JSON',
      category: 'SYSTEM',
      description: 'Website offer popups',
      is_editable: true,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  if (upErr) throw new Error(upErr.message);
  return next;
}
