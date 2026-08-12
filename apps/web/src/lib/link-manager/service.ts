import { randomBytes } from 'crypto';
import {
  buildQrShortUrl,
  buildShortUrl,
  isBrokenStoredQrUrl,
  isLocalOrPrivateUrl,
  isValidHttpUrl,
  normalizeLongUrl,
  normalizeStoredDestinationUrl,
  sanitizeCustomCode,
} from '@/lib/link-manager/utils';
import { generateBrandedQrDataUrl } from '@/lib/link-manager/qr-generator';
import type { QrStyleOptions } from '@/lib/link-manager/qr-types';
import type { UtmParams } from '@/lib/utm';

export type ManagedShortLink = {
  id: string;
  short_code: string;
  long_url: string;
  title?: string | null;
  description?: string | null;
  tags?: string[];
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  qr_code_url?: string | null;
  clicks?: number;
  unique_clicks?: number;
  qr_scans?: number;
  last_clicked_at?: string | null;
  is_active?: boolean;
  expires_at?: string | null;
  created_by?: string | null;
  meta?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export { appendUtmParams, buildShortUrl, isValidHttpUrl, sanitizeCustomCode } from '@/lib/link-manager/utils';

export function generateShortCode(length = 7): string {
  let code = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i += 1) {
    code += BASE62[bytes[i] % 62];
  }
  return code;
}

export async function generateQrDataUrl(data: string, qrStyle?: QrStyleOptions | null): Promise<string> {
  return generateBrandedQrDataUrl(data, qrStyle);
}

/** @deprecated Prefer resolveManagedShortLink from resolve.ts */
export async function resolveManagedShortLinkRedirect(
  shortCode: string,
  request?: {
    ip?: string | null;
    userAgent?: string | null;
    referrer?: string | null;
    queryUtm?: UtmParams;
    isQrScan?: boolean;
    headers?: { get?: (name: string) => string | null } | null;
    passwordUnlocked?: boolean;
    forceRedirect?: boolean;
  },
): Promise<string | null> {
  const { resolveManagedShortLink } = await import('@/lib/link-manager/resolve');
  const result = await resolveManagedShortLink(shortCode, request);
  if (!result) return null;
  if (result.kind === 'redirect' || result.kind === 'gone') return result.url;
  return null;
}

export async function ensureUniqueShortCode(
  supabaseAdmin: any,
  preferred?: string | null,
): Promise<string> {
  const custom = sanitizeCustomCode(preferred || '');
  if (custom) {
    const { data: existing } = await supabaseAdmin
      .from('managed_short_links')
      .select('id')
      .eq('short_code', custom)
      .maybeSingle();
    if (!existing) return custom;
    throw new Error('Custom short code already taken');
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateShortCode(7);
    const { data: existing } = await supabaseAdmin
      .from('managed_short_links')
      .select('id')
      .eq('short_code', code)
      .maybeSingle();
    if (!existing) return code;
  }

  throw new Error('Could not generate unique short code');
}

export async function ensureLinkDestinationIsPublic(
  supabaseAdmin: any,
  link: ManagedShortLink,
): Promise<ManagedShortLink> {
  const normalized = normalizeStoredDestinationUrl(link.long_url);
  if (normalized === link.long_url) return link;

  const { data: updated, error } = await supabaseAdmin
    .from('managed_short_links')
    .update({ long_url: normalized, updated_at: new Date().toISOString() })
    .eq('id', link.id)
    .select('*')
    .single();

  if (error || !updated) return { ...link, long_url: normalized };
  return updated as ManagedShortLink;
}

export type ManagedShortLinkCreateMode = 'link_only' | 'qr_only' | 'both';

export async function ensureLinkQrUsesPublicUrl(
  supabaseAdmin: any,
  link: ManagedShortLink,
  baseUrl?: string | null,
): Promise<ManagedShortLink> {
  const expectedShortUrl = buildShortUrl(link.short_code, baseUrl);
  const expectedQrPayload = buildQrShortUrl(link.short_code);
  const meta = (link.meta || {}) as Record<string, unknown>;
  const createMode = String(meta.create_mode || '');
  const isLinkOnly = createMode === 'link_only' || (!createMode && !link.qr_code_url);

  if (isLinkOnly) {
    return { ...link, short_url: expectedShortUrl };
  }

  const qrPayload = String(meta.qr_payload || meta.public_short_url || '');

  const needsRegenerate =
    !link.qr_code_url ||
    !qrPayload ||
    qrPayload !== expectedQrPayload ||
    isLocalOrPrivateUrl(qrPayload) ||
    isBrokenStoredQrUrl(link.qr_code_url, expectedQrPayload);

  if (!needsRegenerate) {
    return { ...link, short_url: expectedShortUrl };
  }

  const savedStyle = meta.qr_style as QrStyleOptions | undefined;
  const qrCodeUrl = await generateBrandedQrDataUrl(expectedQrPayload, savedStyle || null);
  const nextMeta = {
    ...meta,
    public_short_url: expectedShortUrl,
    qr_payload: expectedQrPayload,
  };

  const { data: updated, error } = await supabaseAdmin
    .from('managed_short_links')
    .update({
      qr_code_url: qrCodeUrl,
      meta: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', link.id)
    .select('*')
    .single();

  if (error || !updated) return { ...link, short_url: expectedShortUrl };
  return { ...updated, short_url: expectedShortUrl };
}

export async function createManagedShortLink(
  supabaseAdmin: any,
  input: {
    long_url: string;
    title?: string;
    description?: string;
    tags?: string[];
    custom_code?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
    expires_at?: string | null;
    created_by?: string;
    qr_style?: QrStyleOptions | null;
    baseUrl?: string | null;
    create_mode?: ManagedShortLinkCreateMode;
    password?: string | null;
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
    ab_variants?: unknown;
    geo_rules?: unknown;
  },
) {
  const { hashLinkPassword, parseAbVariants, parseGeoRules } = await import('@/lib/link-manager/advanced');

  const longUrl = normalizeStoredDestinationUrl(normalizeLongUrl(input.long_url));
  if (!isValidHttpUrl(longUrl)) throw new Error('Enter a valid http/https URL');

  const createMode: ManagedShortLinkCreateMode =
    input.create_mode === 'qr_only' ? 'qr_only' : input.create_mode === 'both' ? 'both' : 'link_only';
  const shortCode = await ensureUniqueShortCode(supabaseAdmin, input.custom_code);
  const shortUrl = buildShortUrl(shortCode, input.baseUrl);
  const qrPayload = buildQrShortUrl(shortCode);
  const qrStyle = input.qr_style || null;
  const wantsQr = createMode === 'qr_only' || createMode === 'both';
  const qrCodeUrl = wantsQr ? await generateBrandedQrDataUrl(qrPayload, qrStyle) : null;

  const abVariants = parseAbVariants(input.ab_variants);
  const geoRules = parseGeoRules(input.geo_rules);

  const meta: Record<string, unknown> = {
    public_short_url: shortUrl,
    qr_payload: wantsQr ? qrPayload : null,
    create_mode: createMode,
    ab_variants: abVariants,
    geo_rules: geoRules,
  };
  if (wantsQr && qrStyle) {
    meta.qr_style = {
      ...qrStyle,
      logo_data_url: qrStyle.logo_data_url ? '[stored]' : null,
    };
  }

  const optionalUrl = (raw: unknown) => {
    const value = String(raw || '').trim();
    if (!value) return null;
    const normalized = normalizeLongUrl(value);
    return isValidHttpUrl(normalized) ? normalizeStoredDestinationUrl(normalized) : null;
  };

  const password = String(input.password || '').trim();
  const maxClicks = Number(input.max_clicks);
  const { data, error } = await supabaseAdmin
    .from('managed_short_links')
    .insert({
      short_code: shortCode,
      long_url: longUrl,
      title: String(input.title || '').trim() || null,
      description: String(input.description || '').trim() || null,
      tags: Array.isArray(input.tags) ? input.tags.filter(Boolean).slice(0, 20) : [],
      utm_source: String(input.utm_source || '').trim() || null,
      utm_medium: String(input.utm_medium || '').trim() || null,
      utm_campaign: String(input.utm_campaign || '').trim() || null,
      utm_term: String(input.utm_term || '').trim() || null,
      utm_content: String(input.utm_content || '').trim() || null,
      qr_code_url: qrCodeUrl,
      expires_at: input.expires_at || null,
      created_by: input.created_by || null,
      meta,
      password_hash: password ? hashLinkPassword(password) : null,
      max_clicks: Number.isFinite(maxClicks) && maxClicks > 0 ? Math.round(maxClicks) : null,
      expired_redirect_url: optionalUrl(input.expired_redirect_url),
      folder: String(input.folder || '').trim().slice(0, 100) || null,
      ios_url: optionalUrl(input.ios_url),
      android_url: optionalUrl(input.android_url),
      desktop_url: optionalUrl(input.desktop_url),
      app_deep_link: String(input.app_deep_link || '').trim() || null,
      og_title: String(input.og_title || '').trim() || null,
      og_description: String(input.og_description || '').trim() || null,
      og_image_url: optionalUrl(input.og_image_url),
      enable_landing: Boolean(input.enable_landing),
      webhook_url: optionalUrl(input.webhook_url),
      pixel_meta_id: String(input.pixel_meta_id || '').trim() || null,
      pixel_google_id: String(input.pixel_google_id || '').trim() || null,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create link');

  return {
    ...data,
    short_url: shortUrl,
  };
}
