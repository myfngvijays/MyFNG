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

export function buildShortUrl(shortCode: string, baseUrl?: string | null) {
  return `${appBaseUrl(baseUrl)}/s/${shortCode}`;
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
