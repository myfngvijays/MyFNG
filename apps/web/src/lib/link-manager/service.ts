import { randomBytes } from 'crypto';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  appendUtmParams,
  buildQrShortUrl,
  buildShortUrl,
  detectLinkPlatform,
  isBrokenStoredQrUrl,
  isLocalOrPrivateUrl,
  isValidHttpUrl,
  normalizeLongUrl,
  normalizeStoredDestinationUrl,
  sanitizeCustomCode,
} from '@/lib/link-manager/utils';
import { generateBrandedQrDataUrl } from '@/lib/link-manager/qr-generator';
import type { QrStyleOptions } from '@/lib/link-manager/qr-types';
import { mergeUtmParams, type UtmParams } from '@/lib/utm';

function buildEffectiveLinkUtm(
  link: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_term?: string | null;
    utm_content?: string | null;
  },
  queryUtm?: UtmParams,
) {
  const merged = mergeUtmParams(
    {
      utm_source: link.utm_source,
      utm_medium: link.utm_medium,
      utm_campaign: link.utm_campaign,
      utm_term: link.utm_term,
      utm_content: link.utm_content,
    },
    queryUtm || {},
  );
  return {
    source: merged.utm_source || null,
    medium: merged.utm_medium || null,
    campaign: merged.utm_campaign || null,
    term: merged.utm_term || null,
    content: merged.utm_content || null,
  };
}

function utmMetaSnapshot(utm: ReturnType<typeof buildEffectiveLinkUtm>) {
  return {
    utm_source: utm.source,
    utm_medium: utm.medium,
    utm_campaign: utm.campaign,
    utm_term: utm.term,
    utm_content: utm.content,
  };
}

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

export async function resolveManagedShortLinkRedirect(
  shortCode: string,
  request?: {
    ip?: string | null;
    userAgent?: string | null;
    referrer?: string | null;
    queryUtm?: UtmParams;
    isQrScan?: boolean;
  },
): Promise<string | null> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  const { data: link, error } = await supabaseAdmin
    .from('managed_short_links')
    .select('*')
    .eq('short_code', shortCode)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !link) return null;
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return null;

  const effectiveUtm = buildEffectiveLinkUtm(link, request?.queryUtm);

  const destination = appendUtmParams(
    normalizeStoredDestinationUrl(link.long_url),
    effectiveUtm,
  );

  const platform = detectLinkPlatform(request?.userAgent);
  const isQrScan = Boolean(request?.isQrScan);

  const ip = request?.ip || null;
  const fingerprint = ip ? `${ip}:${String(request?.userAgent || '').slice(0, 120)}` : null;
  const eventType = isQrScan ? 'qr_scan' : 'click';

  let isUnique = true;
  if (fingerprint && !isQrScan) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('managed_short_link_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('link_id', link.id)
      .eq('event_type', 'click')
      .gte('created_at', since)
      .contains('meta', { fingerprint });
    isUnique = !count;
  }

  await supabaseAdmin.from('managed_short_link_clicks').insert({
    link_id: link.id,
    event_type: eventType,
    ip_address: ip,
    user_agent: request?.userAgent || null,
    referrer: request?.referrer || null,
    meta: {
      ...(fingerprint ? { fingerprint } : {}),
      ...utmMetaSnapshot(effectiveUtm),
      platform,
      source: isQrScan ? 'qr_scan' : 'short_link_redirect',
    },
  }).then(({ error: clickError }) => {
    if (clickError) {
      console.error('[link-manager] failed to log click event:', clickError.message, { shortCode, eventType });
    }
  });

  const { error: updateError } = await supabaseAdmin
    .from('managed_short_links')
    .update({
      ...(isQrScan
        ? { qr_scans: Number(link.qr_scans || 0) + 1 }
        : {
            clicks: Number(link.clicks || 0) + 1,
            unique_clicks: Number(link.unique_clicks || 0) + (isUnique ? 1 : 0),
            last_clicked_at: new Date().toISOString(),
          }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', link.id);

  if (updateError) {
    console.error('[link-manager] failed to update link counters:', updateError.message, { shortCode, eventType });
  }

  return destination;
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

export type ManagedShortLinkCreateMode = 'link_only' | 'qr_only';

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
  },
) {
  const longUrl = normalizeStoredDestinationUrl(normalizeLongUrl(input.long_url));
  if (!isValidHttpUrl(longUrl)) throw new Error('Enter a valid http/https URL');

  const createMode: ManagedShortLinkCreateMode = input.create_mode === 'qr_only' ? 'qr_only' : 'link_only';
  const shortCode = await ensureUniqueShortCode(supabaseAdmin, input.custom_code);
  const shortUrl = buildShortUrl(shortCode, input.baseUrl);
  const qrPayload = buildQrShortUrl(shortCode);
  const qrStyle = input.qr_style || null;
  const qrCodeUrl =
    createMode === 'qr_only' ? await generateBrandedQrDataUrl(qrPayload, qrStyle) : null;

  const meta: Record<string, unknown> = {
    public_short_url: shortUrl,
    qr_payload: createMode === 'qr_only' ? qrPayload : null,
    create_mode: createMode,
  };
  if (createMode === 'qr_only' && qrStyle) {
    meta.qr_style = {
      ...qrStyle,
      logo_data_url: qrStyle.logo_data_url ? '[stored]' : null,
    };
  }

  const { data, error } = await supabaseAdmin
    .from('managed_short_links')
    .insert({
      short_code: shortCode,
      long_url: longUrl,
      title: String(input.title || '').trim() || null,
      description: String(input.description || '').trim() || null,
      tags: Array.isArray(input.tags) ? input.tags.filter(Boolean).slice(0, 10) : [],
      utm_source: String(input.utm_source || '').trim() || null,
      utm_medium: String(input.utm_medium || '').trim() || null,
      utm_campaign: String(input.utm_campaign || '').trim() || null,
      utm_term: String(input.utm_term || '').trim() || null,
      utm_content: String(input.utm_content || '').trim() || null,
      qr_code_url: qrCodeUrl,
      expires_at: input.expires_at || null,
      created_by: input.created_by || null,
      meta,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create link');

  return {
    ...data,
    short_url: shortUrl,
  };
}
