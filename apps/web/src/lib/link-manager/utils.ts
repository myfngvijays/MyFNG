import { SITE_URL } from '@/lib/seo/metadata';

export type UtmParams = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
};

export function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || SITE_URL;
}

export function buildShortUrl(shortCode: string) {
  return `${appBaseUrl()}/s/${shortCode}`;
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
