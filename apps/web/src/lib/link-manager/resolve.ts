import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  fireLinkWebhook,
  linkNeedsInteractiveGate,
  parseAbVariants,
  parseGeoRules,
  resolveAdvancedDestination,
  resolveCountryFromHeaders,
} from '@/lib/link-manager/advanced';
import {
  appendUtmParams,
  detectLinkPlatform,
  normalizeStoredDestinationUrl,
} from '@/lib/link-manager/utils';
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

export type ShortLinkResolveResult =
  | { kind: 'redirect'; url: string }
  | { kind: 'gate'; shortCode: string; unlocked?: boolean }
  | { kind: 'gone'; url: string };

async function logClickAndCounters(
  supabaseAdmin: any,
  link: any,
  opts: {
    ip?: string | null;
    userAgent?: string | null;
    referrer?: string | null;
    platform: string;
    isQrScan: boolean;
    effectiveUtm: ReturnType<typeof buildEffectiveLinkUtm>;
    country?: string | null;
    destination: string;
  },
) {
  const ip = opts.ip || null;
  const fingerprint = ip ? `${ip}:${String(opts.userAgent || '').slice(0, 120)}` : null;
  const eventType = opts.isQrScan ? 'qr_scan' : 'click';

  let isUnique = true;
  if (fingerprint && !opts.isQrScan) {
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
    user_agent: opts.userAgent || null,
    referrer: opts.referrer || null,
    meta: {
      ...(fingerprint ? { fingerprint } : {}),
      utm_source: opts.effectiveUtm.source,
      utm_medium: opts.effectiveUtm.medium,
      utm_campaign: opts.effectiveUtm.campaign,
      utm_term: opts.effectiveUtm.term,
      utm_content: opts.effectiveUtm.content,
      platform: opts.platform,
      country: opts.country || null,
      destination: opts.destination,
      source: opts.isQrScan ? 'qr_scan' : 'short_link_redirect',
    },
  });

  await supabaseAdmin
    .from('managed_short_links')
    .update({
      ...(opts.isQrScan
        ? { qr_scans: Number(link.qr_scans || 0) + 1 }
        : {
            clicks: Number(link.clicks || 0) + 1,
            unique_clicks: Number(link.unique_clicks || 0) + (isUnique ? 1 : 0),
            last_clicked_at: new Date().toISOString(),
          }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', link.id);

  void fireLinkWebhook(link.webhook_url, {
    short_code: link.short_code,
    link_id: link.id,
    event_type: eventType,
    platform: opts.platform,
    country: opts.country || null,
    destination: opts.destination,
  });
}

export async function resolveManagedShortLink(
  shortCode: string,
  request?: {
    ip?: string | null;
    userAgent?: string | null;
    referrer?: string | null;
    queryUtm?: UtmParams;
    isQrScan?: boolean;
    headers?: { get?: (name: string) => string | null } | null;
    /** Cookie/session flag that password was unlocked for this code */
    passwordUnlocked?: boolean;
    /** Skip interactive gate (used by landing page after unlock) */
    forceRedirect?: boolean;
  },
): Promise<ShortLinkResolveResult | null> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  const { data: link, error } = await supabaseAdmin
    .from('managed_short_links')
    .select('*')
    .eq('short_code', shortCode)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !link) return null;

  const expired = Boolean(link.expires_at && new Date(link.expires_at).getTime() < Date.now());
  const maxClicks = link.max_clicks != null ? Number(link.max_clicks) : null;
  const overClicks =
    maxClicks != null && Number.isFinite(maxClicks) && maxClicks > 0 && Number(link.clicks || 0) >= maxClicks;

  if (expired || overClicks) {
    const fallback = String(link.expired_redirect_url || '').trim();
    if (fallback.startsWith('http')) {
      return { kind: 'gone', url: normalizeStoredDestinationUrl(fallback) };
    }
    return { kind: 'gone', url: '/' };
  }

  const needsPassword = Boolean(link.password_hash);
  const needsGate = linkNeedsInteractiveGate(link);
  if (!request?.forceRedirect && needsGate) {
    if (needsPassword && !request?.passwordUnlocked) {
      return { kind: 'gate', shortCode, unlocked: false };
    }
    if (!needsPassword || request?.passwordUnlocked) {
      // Still show landing/pixels/deep-link interstitial when enabled
      if (link.enable_landing || link.app_deep_link || link.pixel_meta_id || link.pixel_google_id || link.og_title) {
        return { kind: 'gate', shortCode, unlocked: true };
      }
    }
  }

  const platform = detectLinkPlatform(request?.userAgent);
  const country = resolveCountryFromHeaders(request?.headers || null);
  const meta = (link.meta || {}) as Record<string, unknown>;
  const seed = `${request?.ip || ''}:${request?.userAgent || ''}:${shortCode}`;

  const baseDestination = resolveAdvancedDestination({
    longUrl: normalizeStoredDestinationUrl(link.long_url),
    platform,
    country,
    seed,
    iosUrl: link.ios_url,
    androidUrl: link.android_url,
    desktopUrl: link.desktop_url,
    geoRules: parseGeoRules(meta.geo_rules),
    abVariants: parseAbVariants(meta.ab_variants),
  });

  const effectiveUtm = buildEffectiveLinkUtm(link, request?.queryUtm);
  const destination = appendUtmParams(baseDestination, effectiveUtm);

  await logClickAndCounters(supabaseAdmin, link, {
    ip: request?.ip,
    userAgent: request?.userAgent,
    referrer: request?.referrer,
    platform,
    isQrScan: Boolean(request?.isQrScan),
    effectiveUtm,
    country,
    destination,
  });

  return { kind: 'redirect', url: destination };
}

/** Fetch link row for landing UI (no click logged). */
export async function getManagedShortLinkPublic(shortCode: string) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('managed_short_links')
    .select(
      'id, short_code, long_url, title, description, is_active, expires_at, max_clicks, clicks, password_hash, expired_redirect_url, ios_url, android_url, desktop_url, app_deep_link, og_title, og_description, og_image_url, enable_landing, pixel_meta_id, pixel_google_id, meta, utm_source, utm_medium, utm_campaign',
    )
    .eq('short_code', shortCode)
    .eq('is_active', true)
    .maybeSingle();
  return data || null;
}
