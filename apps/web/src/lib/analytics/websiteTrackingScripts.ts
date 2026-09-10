import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  DEFAULT_CLARITY_PROJECT_ID,
  DEFAULT_META_PIXEL_ID,
  DEFAULT_OPENAI_ADS_PIXEL_ID,
  DEFAULT_WEB_GA4_MEASUREMENT_ID,
  DEFAULT_WEB_GTM_CONTAINER_ID,
  loadProductAnalyticsConfig,
  saveProductAnalyticsConfig,
  type ProductAnalyticsConfig,
} from '@/lib/analytics/productAnalyticsConfig';

export const WEBSITE_TRACKING_SCRIPTS_KEY = 'website_tracking_scripts';

export const PUBLIC_TRACKING_PAGES: Array<{ path: string; label: string }> = [
  { path: '/', label: 'Home' },
  { path: '/book-service', label: 'Book Service' },
  { path: '/car-roadside-assistance', label: 'RSA' },
  { path: '/rsa_landing', label: 'RSA Landing' },
  { path: '/misa-ai', label: 'MISA AI' },
  { path: '/about', label: 'About' },
  { path: '/contact', label: 'Contact' },
  { path: '/blogs', label: 'Blogs' },
  { path: '/faqs', label: 'FAQs' },
  { path: '/car-services', label: 'Car Services' },
  { path: '/car-loan', label: 'Car Loan' },
  { path: '/workshop-locator', label: 'Workshop Locator' },
  { path: '/pricing', label: 'Pricing' },
  { path: '/ai-experience', label: 'AI Experience' },
];

export type ScriptPlacement = 'head' | 'body';
export type ScriptScope = 'global' | 'pages';
export type ScriptMatch = 'exact' | 'prefix';
export type ScriptConsent = 'always' | 'analytics' | 'advertising';

export type CustomTrackingScript = {
  id: string;
  name: string;
  placement: ScriptPlacement;
  html: string;
  scope: ScriptScope;
  paths: string[];
  match: ScriptMatch;
  consent: ScriptConsent;
  enabled: boolean;
};

export type WebsiteTrackingScriptsConfig = {
  version: 1;
  gtm_enabled: boolean;
  openai_ads_enabled: boolean;
  custom: CustomTrackingScript[];
  updated_at?: string | null;
};

const MAX_CUSTOM = 24;
const MAX_HTML = 24_000;

export function gtmHeadSnippet(id: string) {
  const container = String(id || '').trim() || DEFAULT_WEB_GTM_CONTAINER_ID;
  return `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${container}');</script>
<!-- End Google Tag Manager -->`;
}

export function gtmBodySnippet(id: string) {
  const container = String(id || '').trim() || DEFAULT_WEB_GTM_CONTAINER_ID;
  return `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${container}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;
}

export function ga4Snippet(id: string) {
  const mid = String(id || '').trim() || DEFAULT_WEB_GA4_MEASUREMENT_ID;
  return `<!-- Google Analytics (GA4) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${mid}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${mid}');
</script>`;
}

export function openaiAdsInitJs(id: string, debug = false) {
  const pixel = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '') || DEFAULT_OPENAI_ADS_PIXEL_ID;
  return `!function(w,d,s,u){if(w.oaiq)return;var q=function(){q.q.push(arguments)};q.q=[];w.oaiq=q;var j=d.createElement(s);j.async=1;j.src=u;var f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(j,f)}(window,document,"script","https://bzrcdn.openai.com/sdk/oaiq.min.js");oaiq("init",{pixelId:${JSON.stringify(pixel)},debug:${debug ? 'true' : 'false'}});`;
}

export function openaiAdsSnippet(id: string, debug = false) {
  return `<script>${openaiAdsInitJs(id, debug)}</script>`;
}

export function metaPixelSnippet(id: string) {
  const pixel = String(id || '').trim() || DEFAULT_META_PIXEL_ID;
  return `<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixel}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixel}&ev=PageView&noscript=1"/></noscript>`;
}

export function newCustomScript(partial?: Partial<CustomTrackingScript>): CustomTrackingScript {
  return {
    id: partial?.id || `trk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: String(partial?.name || 'New script').trim() || 'New script',
    placement: partial?.placement === 'body' ? 'body' : 'head',
    html: String(partial?.html || ''),
    scope: partial?.scope === 'pages' ? 'pages' : 'global',
    paths: Array.isArray(partial?.paths) ? partial.paths.map((p) => normalizePath(p)).filter(Boolean) : [],
    match: partial?.match === 'exact' ? 'exact' : 'prefix',
    consent: partial?.consent === 'advertising' || partial?.consent === 'always' ? partial.consent : 'analytics',
    enabled: partial?.enabled !== false,
  };
}

export function normalizePath(raw: string) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const noHost = value.replace(/^https?:\/\/[^/]+/i, '');
  const path = noHost.split('?')[0].split('#')[0] || '/';
  if (path === '/') return '/';
  return path.startsWith('/') ? path.replace(/\/+$/, '') : `/${path.replace(/\/+$/, '')}`;
}

export function scriptMatchesPath(script: CustomTrackingScript, pathname: string) {
  if (!script.enabled) return false;
  if (script.scope !== 'pages') return true;
  const path = normalizePath(pathname) || '/';
  return (script.paths || []).some((raw) => {
    const target = normalizePath(raw);
    if (!target) return false;
    if (target === '/') return path === '/';
    if (script.match === 'exact') return path === target;
    return path === target || path.startsWith(`${target}/`);
  });
}

function normalizeCustom(raw: unknown): CustomTrackingScript[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomTrackingScript[] = [];
  for (const item of raw.slice(0, MAX_CUSTOM)) {
    const html = String((item as CustomTrackingScript)?.html || '').slice(0, MAX_HTML);
    if (!String((item as CustomTrackingScript)?.name || '').trim() && !html.trim()) continue;
    out.push(
      newCustomScript({
        ...(item as CustomTrackingScript),
        html,
      }),
    );
  }
  return out;
}

export function emptyTrackingScriptsConfig(): WebsiteTrackingScriptsConfig {
  return { version: 1, gtm_enabled: true, openai_ads_enabled: true, custom: [], updated_at: null };
}

export function normalizeTrackingScriptsConfig(raw: unknown): WebsiteTrackingScriptsConfig {
  const src = raw && typeof raw === 'object' ? (raw as WebsiteTrackingScriptsConfig) : emptyTrackingScriptsConfig();
  return {
    version: 1,
    gtm_enabled: src.gtm_enabled !== false,
    openai_ads_enabled: src.openai_ads_enabled !== false,
    custom: normalizeCustom(src.custom),
    updated_at: src.updated_at || null,
  };
}

export async function loadWebsiteTrackingScripts(
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>['supabaseAdmin'],
): Promise<WebsiteTrackingScriptsConfig> {
  const db = supabaseAdmin ?? getSupabaseAdmin().supabaseAdmin;
  if (!db) return emptyTrackingScriptsConfig();
  const { data, error } = await db
    .from('system_settings')
    .select('setting_value, updated_at')
    .eq('setting_key', WEBSITE_TRACKING_SCRIPTS_KEY)
    .maybeSingle();
  if (error || !data?.setting_value) return emptyTrackingScriptsConfig();
  let parsed: unknown = data.setting_value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = {};
    }
  }
  return { ...normalizeTrackingScriptsConfig(parsed), updated_at: data.updated_at || null };
}

export async function saveWebsiteTrackingScripts(
  raw: unknown,
  updatedBy: string,
): Promise<{ ok: true; config: WebsiteTrackingScriptsConfig } | { ok: false; error: string }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, error: 'Database admin client unavailable' };
  const config = normalizeTrackingScriptsConfig(raw);
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: WEBSITE_TRACKING_SCRIPTS_KEY,
      setting_value: JSON.stringify(config),
      updated_at: now,
      updated_by: updatedBy,
    },
    { onConflict: 'setting_key' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, config: { ...config, updated_at: now } };
}

export function builtInSnippets(config: ProductAnalyticsConfig) {
  const gtm = config.web_tracking.gtm_container_id || DEFAULT_WEB_GTM_CONTAINER_ID;
  const ga4 = config.firebase.web_measurement_id || DEFAULT_WEB_GA4_MEASUREMENT_ID;
  const pixel = config.web_tracking.meta_pixel_id || DEFAULT_META_PIXEL_ID;
  return {
    gtm_head: gtmHeadSnippet(gtm),
    gtm_body: gtmBodySnippet(gtm),
    ga4: ga4Snippet(ga4),
    meta_pixel: metaPixelSnippet(pixel),
    openai_ads: openaiAdsSnippet(config.web_tracking.openai_ads_pixel_id || DEFAULT_OPENAI_ADS_PIXEL_ID, true),
    clarity_note: `Microsoft Clarity project ${config.clarity.project_id || DEFAULT_CLARITY_PROJECT_ID} loads through GTM (${gtm}) on the website.`,
  };
}

export async function saveBuiltInTrackingIds(
  patch: {
    gtm_container_id?: string;
    web_measurement_id?: string;
    meta_pixel_id?: string;
    openai_ads_pixel_id?: string;
    clarity_project_id?: string;
    gtag_enabled?: boolean;
    meta_pixel_enabled?: boolean;
    gtm_enabled?: boolean;
    clarity_enabled?: boolean;
  },
  updatedBy: string,
) {
  const { supabaseAdmin } = getSupabaseAdmin();
  const config = await loadProductAnalyticsConfig(supabaseAdmin, { bypassCache: true });
  if (patch.gtm_container_id != null) {
    config.web_tracking.gtm_container_id = String(patch.gtm_container_id).trim() || DEFAULT_WEB_GTM_CONTAINER_ID;
  }
  if (patch.web_measurement_id != null) {
    config.firebase.web_measurement_id = String(patch.web_measurement_id).trim() || DEFAULT_WEB_GA4_MEASUREMENT_ID;
  }
  if (patch.meta_pixel_id != null) {
    config.web_tracking.meta_pixel_id = String(patch.meta_pixel_id).trim() || DEFAULT_META_PIXEL_ID;
  }
  if (patch.openai_ads_pixel_id != null) {
    config.web_tracking.openai_ads_pixel_id =
      String(patch.openai_ads_pixel_id).trim() || DEFAULT_OPENAI_ADS_PIXEL_ID;
  }
  if (patch.clarity_project_id != null) {
    config.clarity.project_id = String(patch.clarity_project_id).trim() || DEFAULT_CLARITY_PROJECT_ID;
    config.clarity.dashboard_url = `https://clarity.microsoft.com/projects/view/${config.clarity.project_id}`;
  }
  if (patch.gtag_enabled != null) config.platforms.web.gtag_enabled = patch.gtag_enabled;
  if (patch.meta_pixel_enabled != null) config.platforms.web.meta_pixel_enabled = patch.meta_pixel_enabled;
  if (patch.clarity_enabled != null) config.platforms.web.clarity_enabled = patch.clarity_enabled;
  config.implementation.web_gtm_container = config.web_tracking.gtm_container_id;
  return saveProductAnalyticsConfig(config, updatedBy);
}
