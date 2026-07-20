import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { MYFNG_FIREBASE_DEFAULTS } from '@/lib/push/firebaseProjectDefaults';

export type AnalyticsPlatform = 'android' | 'ios' | 'web';

export type PlatformAnalyticsSettings = {
  firebase_analytics_enabled: boolean;
  clarity_enabled: boolean;
  gtag_enabled: boolean;
  meta_pixel_enabled: boolean;
};

export type ProductAnalyticsConfig = {
  firebase: {
    project_name: string;
    project_id: string;
    android_app_id: string;
    ios_app_id: string;
    web_measurement_id: string;
    android_package: string;
    ios_bundle_id: string;
    console_url: string;
  };
  clarity: {
    project_id: string;
    dashboard_url: string;
  };
  web_tracking: {
    meta_pixel_id: string;
    gtm_container_id: string;
  };
  platforms: Record<AnalyticsPlatform, PlatformAnalyticsSettings>;
  mobile_build: {
    analytics_min_version_code_android: number;
    analytics_min_build_ios: number;
    current_version: string;
    current_build: number;
    notes: string;
  };
  implementation: {
    mobile_firebase_file: string;
    mobile_clarity_file: string;
    mobile_app_entry: string;
    web_ga4_file: string;
    web_gtm_container: string;
    env_clarity_key: string;
  };
  admin_notes: string;
  updated_at?: string | null;
};

export type ProductAnalyticsPublicConfig = {
  firebase: {
    project_id: string;
    web_measurement_id: string;
  };
  clarity: {
    project_id: string;
  };
  web_tracking: {
    meta_pixel_id: string;
    gtm_container_id: string;
  };
  platforms: Record<AnalyticsPlatform, PlatformAnalyticsSettings>;
};

const SETTING_KEY = 'product_analytics_config';

export const DEFAULT_WEB_GA4_MEASUREMENT_ID = 'G-S493ENTH9Z';
export const DEFAULT_CLARITY_PROJECT_ID = 'x0kwaiy8aa';
export const DEFAULT_META_PIXEL_ID = '845395791020784';
export const DEFAULT_WEB_GTM_CONTAINER_ID = 'GTM-N2N59TBR';

/** Website Clarity is live on myfng.in via Google Tag Manager (not a direct layout script). */
export const WEBSITE_CLARITY_LIVE = true;

function defaultPlatformSettings(
  overrides: Partial<PlatformAnalyticsSettings> = {},
): PlatformAnalyticsSettings {
  return {
    firebase_analytics_enabled: true,
    clarity_enabled: true,
    gtag_enabled: true,
    meta_pixel_enabled: true,
    ...overrides,
  };
}

export const DEFAULT_PRODUCT_ANALYTICS_CONFIG: ProductAnalyticsConfig = {
  firebase: {
    project_name: MYFNG_FIREBASE_DEFAULTS.project_name,
    project_id: MYFNG_FIREBASE_DEFAULTS.project_id,
    android_app_id: MYFNG_FIREBASE_DEFAULTS.android_app_id,
    ios_app_id: MYFNG_FIREBASE_DEFAULTS.ios_app_id,
    web_measurement_id: DEFAULT_WEB_GA4_MEASUREMENT_ID,
    android_package: MYFNG_FIREBASE_DEFAULTS.android_package,
    ios_bundle_id: MYFNG_FIREBASE_DEFAULTS.ios_bundle_id,
    console_url: `https://console.firebase.google.com/project/${MYFNG_FIREBASE_DEFAULTS.project_id}/analytics`,
  },
  clarity: {
    project_id: DEFAULT_CLARITY_PROJECT_ID,
    dashboard_url: `https://clarity.microsoft.com/projects/view/${DEFAULT_CLARITY_PROJECT_ID}`,
  },
  web_tracking: {
    meta_pixel_id: DEFAULT_META_PIXEL_ID,
    gtm_container_id: DEFAULT_WEB_GTM_CONTAINER_ID,
  },
  platforms: {
    android: defaultPlatformSettings({ gtag_enabled: false, meta_pixel_enabled: false }),
    ios: defaultPlatformSettings({ gtag_enabled: false, meta_pixel_enabled: false }),
    web: defaultPlatformSettings({
      firebase_analytics_enabled: false,
    }),
  },
  mobile_build: {
    analytics_min_version_code_android: 27,
    analytics_min_build_ios: 27,
    current_version: '1.2.3',
    current_build: 28,
    notes:
      'Firebase Analytics + Clarity require a native rebuild (not Expo Go). Play Store build vc27+ includes both SDKs.',
  },
  implementation: {
    mobile_firebase_file: 'apps/mobile/src/lib/firebaseAnalytics.ts',
    mobile_clarity_file: 'apps/mobile/src/lib/clarity.ts',
    mobile_app_entry: 'apps/mobile/App.tsx',
    web_ga4_file: 'apps/web/src/app/(public)/layout.tsx',
    web_gtm_container: DEFAULT_WEB_GTM_CONTAINER_ID,
    env_clarity_key: 'EXPO_PUBLIC_CLARITY_PROJECT_ID',
  },
  admin_notes: '',
  updated_at: null,
};

let cached: { value: ProductAnalyticsConfig; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

function toBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  const text = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(text)) return true;
  if (['false', '0', 'no', 'off'].includes(text)) return false;
  return fallback;
}

function toNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function toText(value: unknown, fallback: string, maxLen: number): string {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.slice(0, maxLen);
}

function mergePlatformSettings(
  raw: unknown,
  fallback: PlatformAnalyticsSettings,
): PlatformAnalyticsSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<PlatformAnalyticsSettings>;
  return {
    firebase_analytics_enabled: toBool(src.firebase_analytics_enabled, fallback.firebase_analytics_enabled),
    clarity_enabled: toBool(src.clarity_enabled, fallback.clarity_enabled),
    gtag_enabled: toBool(src.gtag_enabled, fallback.gtag_enabled),
    meta_pixel_enabled: toBool(src.meta_pixel_enabled, fallback.meta_pixel_enabled),
  };
}

export function normalizeProductAnalyticsConfig(raw: unknown): ProductAnalyticsConfig {
  const base = DEFAULT_PRODUCT_ANALYTICS_CONFIG;
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<ProductAnalyticsConfig>;
  const firebase = (src.firebase && typeof src.firebase === 'object' ? src.firebase : {}) as Partial<
    ProductAnalyticsConfig['firebase']
  >;
  const clarity = (src.clarity && typeof src.clarity === 'object' ? src.clarity : {}) as Partial<
    ProductAnalyticsConfig['clarity']
  >;
  const webTracking = (src.web_tracking && typeof src.web_tracking === 'object' ? src.web_tracking : {}) as Partial<
    ProductAnalyticsConfig['web_tracking']
  >;
  const platforms = (src.platforms && typeof src.platforms === 'object' ? src.platforms : {}) as Partial<
    Record<AnalyticsPlatform, unknown>
  >;
  const mobileBuild = (src.mobile_build && typeof src.mobile_build === 'object'
    ? src.mobile_build
    : {}) as Partial<ProductAnalyticsConfig['mobile_build']>;
  const implementation = (src.implementation && typeof src.implementation === 'object'
    ? src.implementation
    : {}) as Partial<ProductAnalyticsConfig['implementation']>;

  const projectId = toText(firebase.project_id, base.firebase.project_id, 120);

  return {
    firebase: {
      project_name: toText(firebase.project_name, base.firebase.project_name, 80),
      project_id: projectId,
      android_app_id: toText(firebase.android_app_id, base.firebase.android_app_id, 120),
      ios_app_id: toText(firebase.ios_app_id, base.firebase.ios_app_id, 120),
      web_measurement_id: toText(firebase.web_measurement_id, base.firebase.web_measurement_id, 32),
      android_package: toText(firebase.android_package, base.firebase.android_package, 120),
      ios_bundle_id: toText(firebase.ios_bundle_id, base.firebase.ios_bundle_id, 120),
      console_url: toText(
        firebase.console_url,
        `https://console.firebase.google.com/project/${projectId}/analytics`,
        240,
      ),
    },
    clarity: {
      project_id: toText(clarity.project_id, base.clarity.project_id, 64),
      dashboard_url: toText(
        clarity.dashboard_url,
        `https://clarity.microsoft.com/projects/view/${toText(clarity.project_id, base.clarity.project_id, 64)}`,
        240,
      ),
    },
    web_tracking: {
      meta_pixel_id: toText(webTracking.meta_pixel_id, base.web_tracking.meta_pixel_id, 64),
      gtm_container_id: toText(webTracking.gtm_container_id, base.web_tracking.gtm_container_id, 32),
    },
    platforms: {
      android: mergePlatformSettings(platforms.android, base.platforms.android),
      ios: mergePlatformSettings(platforms.ios, base.platforms.ios),
      web: mergePlatformSettings(platforms.web, base.platforms.web),
    },
    mobile_build: {
      analytics_min_version_code_android: toNumber(
        mobileBuild.analytics_min_version_code_android,
        base.mobile_build.analytics_min_version_code_android,
        1,
        9999,
      ),
      analytics_min_build_ios: toNumber(
        mobileBuild.analytics_min_build_ios,
        base.mobile_build.analytics_min_build_ios,
        1,
        9999,
      ),
      current_version: toText(mobileBuild.current_version, base.mobile_build.current_version, 16),
      current_build: toNumber(mobileBuild.current_build, base.mobile_build.current_build, 1, 9999),
      notes: toText(mobileBuild.notes, base.mobile_build.notes, 2000),
    },
    implementation: {
      mobile_firebase_file: toText(
        implementation.mobile_firebase_file,
        base.implementation.mobile_firebase_file,
        200,
      ),
      mobile_clarity_file: toText(
        implementation.mobile_clarity_file,
        base.implementation.mobile_clarity_file,
        200,
      ),
      mobile_app_entry: toText(implementation.mobile_app_entry, base.implementation.mobile_app_entry, 200),
      web_ga4_file: toText(implementation.web_ga4_file, base.implementation.web_ga4_file, 200),
      web_gtm_container: toText(
        implementation.web_gtm_container,
        base.implementation.web_gtm_container,
        32,
      ),
      env_clarity_key: toText(implementation.env_clarity_key, base.implementation.env_clarity_key, 80),
    },
    admin_notes: toText(src.admin_notes, '', 4000),
    updated_at: src.updated_at ?? null,
  };
}

function parseStoredConfig(raw: unknown): ProductAnalyticsConfig | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return normalizeProductAnalyticsConfig(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return normalizeProductAnalyticsConfig(raw);
  }
  return null;
}

/** Reflects tracking that is already live on myfng.in (GTM + public layout scripts). */
export function applyKnownWebsiteTracking(config: ProductAnalyticsConfig): ProductAnalyticsConfig {
  const normalized = normalizeProductAnalyticsConfig(config);
  if (!WEBSITE_CLARITY_LIVE) return normalized;

  return normalizeProductAnalyticsConfig({
    ...normalized,
    platforms: {
      ...normalized.platforms,
      web: {
        ...normalized.platforms.web,
        clarity_enabled: true,
      },
    },
  });
}

export function productAnalyticsToPublicPayload(config: ProductAnalyticsConfig): ProductAnalyticsPublicConfig {
  return {
    firebase: {
      project_id: config.firebase.project_id,
      web_measurement_id: config.firebase.web_measurement_id,
    },
    clarity: {
      project_id: config.clarity.project_id,
    },
    web_tracking: {
      meta_pixel_id: config.web_tracking.meta_pixel_id,
      gtm_container_id: config.web_tracking.gtm_container_id,
    },
    platforms: config.platforms,
  };
}

export async function loadProductAnalyticsConfig(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>['supabaseAdmin'],
  options?: { bypassCache?: boolean },
): Promise<ProductAnalyticsConfig> {
  if (!options?.bypassCache && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (!supabaseAdmin) {
    return DEFAULT_PRODUCT_ANALYTICS_CONFIG;
  }

  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value, updated_at')
    .eq('setting_key', SETTING_KEY)
    .maybeSingle();

  if (error || !data?.setting_value) {
    cached = { value: DEFAULT_PRODUCT_ANALYTICS_CONFIG, expiresAt: Date.now() + CACHE_TTL_MS };
    return DEFAULT_PRODUCT_ANALYTICS_CONFIG;
  }

  const parsed = parseStoredConfig(data.setting_value);
  const normalized = parsed
    ? { ...parsed, updated_at: data.updated_at ?? parsed.updated_at ?? null }
    : DEFAULT_PRODUCT_ANALYTICS_CONFIG;

  cached = { value: normalized, expiresAt: Date.now() + CACHE_TTL_MS };
  return normalized;
}

export async function saveProductAnalyticsConfig(
  raw: unknown,
  updatedBy: string,
): Promise<{ ok: true; config: ProductAnalyticsConfig } | { ok: false; error: string }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { ok: false, error: 'Database admin client unavailable' };
  }

  const config = normalizeProductAnalyticsConfig(raw);
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: SETTING_KEY,
      setting_value: JSON.stringify(config),
      updated_at: now,
      updated_by: updatedBy,
    },
    { onConflict: 'setting_key' },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  cached = { value: { ...config, updated_at: now }, expiresAt: Date.now() + CACHE_TTL_MS };
  return { ok: true, config: { ...config, updated_at: now } };
}

export async function updateMobileFirebaseAnalyticsFlags(
  flags: { android?: boolean; ios?: boolean },
  updatedBy: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  const config = await loadProductAnalyticsConfig(supabaseAdmin, { bypassCache: true });
  if (flags.android !== undefined) {
    config.platforms.android.firebase_analytics_enabled = flags.android;
  }
  if (flags.ios !== undefined) {
    config.platforms.ios.firebase_analytics_enabled = flags.ios;
  }
  const result = await saveProductAnalyticsConfig(config, updatedBy);
  if (!result.ok) return result;
  return { ok: true };
}

export type PlatformAnalyticsStatus = {
  platform: AnalyticsPlatform;
  label: string;
  firebase_analytics: { enabled: boolean; label: string; detail: string };
  clarity: { enabled: boolean; label: string; detail: string };
  gtag: { enabled: boolean; label: string; detail: string };
  meta_pixel: { enabled: boolean; label: string; detail: string };
  identifiers: { label: string; value: string }[];
  external_links: { label: string; href: string }[];
};

export function buildPlatformStatuses(config: ProductAnalyticsConfig): PlatformAnalyticsStatus[] {
  return [
    {
      platform: 'android',
      label: 'Android',
      firebase_analytics: {
        enabled: config.platforms.android.firebase_analytics_enabled,
        label: 'Firebase Analytics',
        detail: `App ID ${config.firebase.android_app_id} · min vc${config.mobile_build.analytics_min_version_code_android}+`,
      },
      clarity: {
        enabled: config.platforms.android.clarity_enabled,
        label: 'Microsoft Clarity',
        detail: `Project ${config.clarity.project_id}`,
      },
      gtag: {
        enabled: false,
        label: 'GA4 (gtag)',
        detail: 'Not used on native Android',
      },
      meta_pixel: {
        enabled: false,
        label: 'Meta Pixel',
        detail: 'Not used on native Android',
      },
      identifiers: [
        { label: 'Package', value: config.firebase.android_package },
        { label: 'Firebase App ID', value: config.firebase.android_app_id },
        { label: 'Min version code', value: String(config.mobile_build.analytics_min_version_code_android) },
      ],
      external_links: [
        { label: 'Firebase Console', href: config.firebase.console_url },
        { label: 'Clarity Dashboard', href: config.clarity.dashboard_url },
      ],
    },
    {
      platform: 'ios',
      label: 'iOS',
      firebase_analytics: {
        enabled: config.platforms.ios.firebase_analytics_enabled,
        label: 'Firebase Analytics',
        detail: `App ID ${config.firebase.ios_app_id} · min build ${config.mobile_build.analytics_min_build_ios}+`,
      },
      clarity: {
        enabled: config.platforms.ios.clarity_enabled,
        label: 'Microsoft Clarity',
        detail: `Project ${config.clarity.project_id}`,
      },
      gtag: {
        enabled: false,
        label: 'GA4 (gtag)',
        detail: 'Not used on native iOS',
      },
      meta_pixel: {
        enabled: false,
        label: 'Meta Pixel',
        detail: 'Not used on native iOS',
      },
      identifiers: [
        { label: 'Bundle ID', value: config.firebase.ios_bundle_id },
        { label: 'Firebase App ID', value: config.firebase.ios_app_id },
        { label: 'Min build', value: String(config.mobile_build.analytics_min_build_ios) },
      ],
      external_links: [
        { label: 'Firebase Console', href: config.firebase.console_url },
        { label: 'Clarity Dashboard', href: config.clarity.dashboard_url },
      ],
    },
    {
      platform: 'web',
      label: 'Website',
      firebase_analytics: {
        enabled: false,
        label: 'Firebase Analytics (mobile SDK)',
        detail: 'Website uses GA4 gtag instead of Firebase mobile SDK',
      },
      clarity: {
        enabled: config.platforms.web.clarity_enabled,
        label: 'Microsoft Clarity',
        detail: config.platforms.web.clarity_enabled
          ? `Project ${config.clarity.project_id} · live via GTM (${config.web_tracking.gtm_container_id})`
          : 'Disabled in admin settings',
      },
      gtag: {
        enabled: config.platforms.web.gtag_enabled,
        label: 'Google Analytics 4',
        detail: `Measurement ID ${config.firebase.web_measurement_id}`,
      },
      meta_pixel: {
        enabled: config.platforms.web.meta_pixel_enabled,
        label: 'Meta Pixel',
        detail: `Pixel ID ${config.web_tracking.meta_pixel_id}`,
      },
      identifiers: [
        { label: 'GA4 Measurement ID', value: config.firebase.web_measurement_id },
        { label: 'Clarity Project ID', value: config.clarity.project_id },
        { label: 'GTM Container', value: config.web_tracking.gtm_container_id },
        { label: 'Meta Pixel ID', value: config.web_tracking.meta_pixel_id },
        { label: 'Firebase Project', value: config.firebase.project_id },
      ],
      external_links: [
        { label: 'GA4 Admin', href: 'https://analytics.google.com/' },
        { label: 'Clarity Dashboard', href: config.clarity.dashboard_url },
        { label: 'Firebase Console', href: config.firebase.console_url },
      ],
    },
  ];
}
