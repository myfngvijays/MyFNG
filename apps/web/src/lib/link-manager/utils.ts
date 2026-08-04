import { SITE_URL } from '@/lib/seo/metadata';

export type UtmParams = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

function normalizeBaseUrl(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim().replace(/\/$/, '');
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (LOCAL_HOSTS.has(url.hostname.toLowerCase())) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** Public site base URL — never returns localhost / 0.0.0.0. */
export function appBaseUrl(preferred?: string | null): string {
  const candidates = [
    preferred,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    SITE_URL,
  ];
  for (const raw of candidates) {
    const normalized = normalizeBaseUrl(raw);
    if (normalized) return normalized;
  }
  return SITE_URL;
}

/** Prefer the incoming request host on server (e.g. myfng.in). */
export function getRequestBaseUrl(request?: { headers?: { get?: (name: string) => string | null } }): string {
  const host = request?.headers?.get?.('x-forwarded-host') || request?.headers?.get?.('host');
  const proto = request?.headers?.get?.('x-forwarded-proto') || 'https';
  if (host) {
    const hostname = host.split(':')[0].toLowerCase();
    if (!LOCAL_HOSTS.has(hostname)) {
      return appBaseUrl(`${proto}://${host}`);
    }
  }
  return appBaseUrl();
}

/** Browser admin UI — use current origin when not local dev. */
export function clientAppBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const normalized = normalizeBaseUrl(window.location.origin);
    if (normalized) return normalized;
  }
  return appBaseUrl();
}

export function buildProductionShortUrl(shortCode: string) {
  const code = String(shortCode || '').trim();
  return `${SITE_URL.replace(/\/$/, '')}/s/${code}`;
}

export function normalizeStoredDestinationUrl(raw: string | null | undefined): string {
  return sanitizePublicRedirectUrl(String(raw || SITE_URL)).toString();
}

/** Always return an absolute public URL — never localhost / 0.0.0.0. */
export function sanitizePublicRedirectUrl(raw: string): URL {
  const site = SITE_URL.replace(/\/$/, '');
  const trimmed = String(raw || '').trim();
  if (!trimmed) return new URL(`${site}/`);

  try {
    let url: URL;
    if (/^https?:\/\//i.test(trimmed)) {
      url = new URL(trimmed);
    } else {
      url = new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, `${site}/`);
    }

    if (LOCAL_HOSTS.has(url.hostname.toLowerCase())) {
      return new URL(`${url.pathname}${url.search}${url.hash}`, `${site}/`);
    }
    return url;
  } catch {
    return new URL(`${site}/`);
  }
}

export function detectLinkPlatform(userAgent: string | null | undefined): 'ios' | 'android' | 'desktop' {
  const ua = String(userAgent || '').toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

export function linkEventSourceLabel(eventType: string): string {
  if (eventType === 'qr_scan') return 'qr scan';
  if (eventType === 'click') return 'short link redirect';
  return String(eventType || 'click').replace(/_/g, ' ');
}

export function buildShortUrl(shortCode: string, baseUrl?: string | null) {
  void baseUrl;
  return buildProductionShortUrl(shortCode);
}

/** Read encoded URL from legacy qrserver.com image links stored in DB. */
export function extractQrEncodedUrl(qrCodeUrl: string | null | undefined): string | null {
  const raw = String(qrCodeUrl || '').trim();
  if (!raw.startsWith('https://api.qrserver.com/')) return null;
  try {
    return new URL(raw).searchParams.get('data');
  } catch {
    return null;
  }
}

export function isBrokenStoredQrUrl(
  qrCodeUrl: string | null | undefined,
  expectedPayload: string,
): boolean {
  const encoded = extractQrEncodedUrl(qrCodeUrl);
  if (!encoded) return false;
  return encoded !== expectedPayload || isLocalOrPrivateUrl(encoded);
}

export function isLocalOrPrivateUrl(url: string | null | undefined): boolean {
  return !normalizeBaseUrl(url);
}

export function normalizeLongUrl(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function sanitizeCustomCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 32);
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function appendUtmParams(longUrl: string, utm?: UtmParams) {
  if (!utm?.source && !utm?.medium && !utm?.campaign && !utm?.term && !utm?.content) {
    return longUrl;
  }
  const url = new URL(longUrl);
  if (utm.source) url.searchParams.set('utm_source', utm.source);
  if (utm.medium) url.searchParams.set('utm_medium', utm.medium);
  if (utm.campaign) url.searchParams.set('utm_campaign', utm.campaign);
  if (utm.term) url.searchParams.set('utm_term', utm.term);
  if (utm.content) url.searchParams.set('utm_content', utm.content);
  return url.toString();
}

export function buildPreviewShortCode(customCode: string) {
  const custom = sanitizeCustomCode(customCode);
  return custom || 'your-link';
}

export function buildQrPreviewUrl(data: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}
