import { ENV } from '../config/environment';

const PRODUCTION_SITE = 'https://myfng.in';

function mediaOrigin(): string {
  const origin = String(ENV.WEBSITE_URL || ENV.API_URL || PRODUCTION_SITE).replace(/\/$/, '');
  if (/localhost|127\.0\.0\.1|10\.0\.2\.2/i.test(origin)) return PRODUCTION_SITE;
  return origin || PRODUCTION_SITE;
}

/** React Native Image needs an absolute https URL. Blog/API often returns `/media/...`. */
export function resolvePublicMediaUrl(input?: string | null): string {
  const value = String(input || '').trim();
  if (!value) return '';
  if (/^(https?:|data:|file:)/i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  const origin = mediaOrigin();
  if (value.startsWith('/')) return `${origin}${value}`;
  return `${origin}/media/${value.replace(/^\/+/, '')}`;
}
