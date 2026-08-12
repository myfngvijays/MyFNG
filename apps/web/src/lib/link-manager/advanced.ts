import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export type LinkPlatform = 'ios' | 'android' | 'desktop';

export type AbVariant = { url: string; weight: number };
export type GeoRule = { countries: string[]; url: string };

export type AdvancedLinkConfig = {
  password?: string | null;
  password_hash?: string | null;
  max_clicks?: number | null;
  expired_redirect_url?: string | null;
  folder?: string | null;
  ios_url?: string | null;
  android_url?: string | null;
  desktop_url?: string | null;
  app_deep_link?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  enable_landing?: boolean;
  webhook_url?: string | null;
  pixel_meta_id?: string | null;
  pixel_google_id?: string | null;
  ab_variants?: AbVariant[];
  geo_rules?: GeoRule[];
  create_mode?: 'link_only' | 'qr_only' | 'both';
};

export function hashLinkPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyLinkPassword(password: string, stored: string | null | undefined): boolean {
  const raw = String(stored || '');
  const [salt, hash] = raw.split(':');
  if (!salt || !hash) return false;
  try {
    const next = scryptSync(String(password), salt, 32);
    const prev = Buffer.from(hash, 'hex');
    if (next.length !== prev.length) return false;
    return timingSafeEqual(next, prev);
  } catch {
    return false;
  }
}

export function parseAbVariants(raw: unknown): AbVariant[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => ({
      url: String((row as any)?.url || '').trim(),
      weight: Math.max(0, Number((row as any)?.weight) || 0),
    }))
    .filter((row) => row.url.startsWith('http') && row.weight > 0)
    .slice(0, 6);
}

export function parseGeoRules(raw: unknown): GeoRule[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => ({
      countries: Array.isArray((row as any)?.countries)
        ? (row as any).countries.map((c: unknown) => String(c || '').trim().toUpperCase()).filter(Boolean)
        : String((row as any)?.countries || '')
            .split(/[\s,]+/)
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean),
      url: String((row as any)?.url || '').trim(),
    }))
    .filter((row) => row.countries.length > 0 && row.url.startsWith('http'))
    .slice(0, 20);
}

export function pickAbVariant(variants: AbVariant[], seed: string): string | null {
  if (!variants.length) return null;
  const total = variants.reduce((sum, v) => sum + v.weight, 0);
  if (total <= 0) return variants[0]?.url || null;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  let cursor = h % total;
  for (const v of variants) {
    cursor -= v.weight;
    if (cursor < 0) return v.url;
  }
  return variants[variants.length - 1]?.url || null;
}

export function resolveCountryFromHeaders(headers?: {
  get?: (name: string) => string | null;
} | null): string | null {
  if (!headers?.get) return null;
  const candidates = [
    headers.get('x-vercel-ip-country'),
    headers.get('cf-ipcountry'),
    headers.get('x-country-code'),
    headers.get('cloudfront-viewer-country'),
  ];
  for (const raw of candidates) {
    const code = String(raw || '').trim().toUpperCase();
    if (code && code.length === 2 && code !== 'XX') return code;
  }
  return null;
}

export function resolveAdvancedDestination(opts: {
  longUrl: string;
  platform: LinkPlatform;
  country?: string | null;
  seed: string;
  iosUrl?: string | null;
  androidUrl?: string | null;
  desktopUrl?: string | null;
  geoRules?: GeoRule[];
  abVariants?: AbVariant[];
}): string {
  const country = String(opts.country || '').toUpperCase();
  if (country && opts.geoRules?.length) {
    const hit = opts.geoRules.find((rule) => rule.countries.includes(country));
    if (hit?.url) return hit.url;
  }

  if (opts.platform === 'ios' && opts.iosUrl) return opts.iosUrl;
  if (opts.platform === 'android' && opts.androidUrl) return opts.androidUrl;
  if (opts.platform === 'desktop' && opts.desktopUrl) return opts.desktopUrl;

  const ab = pickAbVariant(opts.abVariants || [], opts.seed);
  if (ab) return ab;

  return opts.longUrl;
}

export function linkNeedsInteractiveGate(link: {
  password_hash?: string | null;
  enable_landing?: boolean | null;
  app_deep_link?: string | null;
  pixel_meta_id?: string | null;
  pixel_google_id?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
}): boolean {
  if (link.password_hash) return true;
  if (link.enable_landing) return true;
  if (link.app_deep_link) return true;
  if (link.pixel_meta_id || link.pixel_google_id) return true;
  if (link.og_title || link.og_description || link.og_image_url) return true;
  return false;
}

export async function fireLinkWebhook(
  webhookUrl: string | null | undefined,
  payload: Record<string, unknown>,
) {
  const url = String(webhookUrl || '').trim();
  if (!url.startsWith('http')) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'short_link_click', ...payload, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // best-effort
  }
}
