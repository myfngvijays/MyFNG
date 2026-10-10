import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export type TopOfferBannerConfig = {
  enabled: boolean;
  headline: string;
  offer_label: string;
  show_countdown: boolean;
  button_label: string;
  button_href: string;
  text_color: string;
  offer_color: string;
  background_from: string;
  background_via: string;
  background_to: string;
  button_background: string;
  button_text: string;
};

export const DEFAULT_TOP_OFFER_BANNER: TopOfferBannerConfig = {
  enabled: true,
  headline: 'Download MyFNG App & Get 10% OFF',
  offer_label: 'Navratri Offer →',
  show_countdown: true,
  button_label: 'Download App',
  button_href: '/go/myfngapp',
  text_color: '#ffffff',
  offer_color: '#fde68a',
  background_from: '#6b1224',
  background_via: '#9a3412',
  background_to: '#c2410c',
  button_background: '#fff7d6',
  button_text: '#6b1224',
};

const SETTING_KEY = 'website_top_offer_banner';

function hex(value: unknown, fallback: string) {
  const raw = String(value ?? '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw) || /^#[0-9a-fA-F]{3}$/.test(raw)) return raw.toLowerCase();
  return fallback;
}

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

export function normalizeTopOfferBanner(input?: Partial<TopOfferBannerConfig> | null): TopOfferBannerConfig {
  const base = DEFAULT_TOP_OFFER_BANNER;
  return {
    enabled: input?.enabled !== false,
    headline: text(input?.headline, base.headline, 120),
    offer_label: text(input?.offer_label, base.offer_label, 60),
    show_countdown: input?.show_countdown !== false,
    button_label: text(input?.button_label, base.button_label, 40),
    button_href: href(input?.button_href, base.button_href),
    text_color: hex(input?.text_color, base.text_color),
    offer_color: hex(input?.offer_color, base.offer_color),
    background_from: hex(input?.background_from, base.background_from),
    background_via: hex(input?.background_via, base.background_via),
    background_to: hex(input?.background_to, base.background_to),
    button_background: hex(input?.button_background, base.button_background),
    button_text: hex(input?.button_text, base.button_text),
  };
}

export async function getTopOfferBanner(): Promise<TopOfferBannerConfig> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return DEFAULT_TOP_OFFER_BANNER;
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', SETTING_KEY)
    .maybeSingle();
  const raw = String((data as { setting_value?: string } | null)?.setting_value || '').trim();
  if (!raw) return DEFAULT_TOP_OFFER_BANNER;
  try {
    return normalizeTopOfferBanner(JSON.parse(raw));
  } catch {
    return DEFAULT_TOP_OFFER_BANNER;
  }
}

export async function saveTopOfferBanner(config: TopOfferBannerConfig, userId?: string | null) {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Admin client unavailable');
  const next = normalizeTopOfferBanner(config);
  const { error: upErr } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: SETTING_KEY,
      setting_value: JSON.stringify(next),
      setting_type: 'JSON',
      category: 'SYSTEM',
      description: 'Website top offer banner text and colors',
      is_editable: true,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  if (upErr) throw new Error(upErr.message);
  return next;
}
