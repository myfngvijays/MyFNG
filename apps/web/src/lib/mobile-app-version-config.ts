import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export type MobilePlatform = 'android' | 'ios';
export type MobileAppKind = 'customer' | 'partner';

export type MobileAppVersionConfig = {
  force_update_enabled: boolean;
  min_version_android: string;
  min_version_ios: string;
  min_build_android: number;
  min_build_ios: number;
  play_store_url: string;
  app_store_url: string;
  update_message: string;
  partner_force_update_enabled: boolean;
  partner_min_version_android: string;
  partner_min_version_ios: string;
  partner_min_build_android: number;
  partner_min_build_ios: number;
  partner_play_store_url: string;
  partner_app_store_url: string;
  partner_update_message: string;
};

export type ForceUpdateEvaluation = {
  required: boolean;
  app: MobileAppKind;
  platform: MobilePlatform;
  store_url: string;
  message: string;
  min_version: string;
  min_build: number;
  current_version: string;
  current_build: number;
};

export const DEFAULT_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.myfng.app';
export const DEFAULT_APP_STORE_URL =
  'https://apps.apple.com/in/app/myfng-trusted-car-care/id6767495114';
export const DEFAULT_FORCE_UPDATE_MESSAGE =
  'A new version of MyFNG is available. Please update the app to continue.';
export const DEFAULT_PARTNER_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.myfng.partner';
export const DEFAULT_PARTNER_APP_STORE_URL = 'https://apps.apple.com/in/app/myfng-partner';
export const DEFAULT_PARTNER_FORCE_UPDATE_MESSAGE =
  'A new version of MyFNG Partner is available. Please update the app to continue.';

export const DEFAULT_MOBILE_APP_VERSION_CONFIG: MobileAppVersionConfig = {
  force_update_enabled: true,
  min_version_android: '1.2.0',
  min_version_ios: '1.2.0',
  min_build_android: 23,
  min_build_ios: 23,
  play_store_url: DEFAULT_PLAY_STORE_URL,
  app_store_url: DEFAULT_APP_STORE_URL,
  update_message: DEFAULT_FORCE_UPDATE_MESSAGE,
  partner_force_update_enabled: false,
  partner_min_version_android: '1.0.1',
  partner_min_version_ios: '1.0.1',
  partner_min_build_android: 1,
  partner_min_build_ios: 1,
  partner_play_store_url: DEFAULT_PARTNER_PLAY_STORE_URL,
  partner_app_store_url: DEFAULT_PARTNER_APP_STORE_URL,
  partner_update_message: DEFAULT_PARTNER_FORCE_UPDATE_MESSAGE,
};

export const MOBILE_APP_VERSION_SETTING_KEYS = {
  force_update_enabled: 'mobile_app_force_update_enabled',
  min_version_android: 'mobile_app_min_version_android',
  min_version_ios: 'mobile_app_min_version_ios',
  min_build_android: 'mobile_app_min_build_android',
  min_build_ios: 'mobile_app_min_build_ios',
  play_store_url: 'mobile_app_play_store_url',
  app_store_url: 'mobile_app_app_store_url',
  update_message: 'mobile_app_force_update_message',
  partner_force_update_enabled: 'mobile_app_partner_force_update_enabled',
  partner_min_version_android: 'mobile_app_partner_min_version_android',
  partner_min_version_ios: 'mobile_app_partner_min_version_ios',
  partner_min_build_android: 'mobile_app_partner_min_build_android',
  partner_min_build_ios: 'mobile_app_partner_min_build_ios',
  partner_play_store_url: 'mobile_app_partner_play_store_url',
  partner_app_store_url: 'mobile_app_partner_app_store_url',
  partner_update_message: 'mobile_app_partner_force_update_message',
} as const;

const SETTING_KEYS = MOBILE_APP_VERSION_SETTING_KEYS;

let cached: { value: MobileAppVersionConfig; expiresAt: number } | null = null;

function toBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
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

function toVersion(value: unknown, fallback: string): string {
  const text = toText(value, fallback, 16);
  const match = text.match(/^\d+(?:\.\d+){0,3}$/);
  return match ? match[0] : fallback;
}

export function clearMobileAppVersionConfigCache() {
  cached = null;
}

export function compareAppVersions(current: string, minimum: string): number {
  const parse = (value: string) =>
    value
      .split('.')
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isFinite(part) ? part : 0));

  const left = parse(current);
  const right = parse(minimum);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

function readConfigFromMap(map: Map<string, string>): MobileAppVersionConfig {
  const base = DEFAULT_MOBILE_APP_VERSION_CONFIG;
  return {
    force_update_enabled: toBool(map.get(SETTING_KEYS.force_update_enabled), base.force_update_enabled),
    min_version_android: toVersion(map.get(SETTING_KEYS.min_version_android), base.min_version_android),
    min_version_ios: toVersion(map.get(SETTING_KEYS.min_version_ios), base.min_version_ios),
    min_build_android: toNumber(map.get(SETTING_KEYS.min_build_android), base.min_build_android, 0, 999999),
    min_build_ios: toNumber(map.get(SETTING_KEYS.min_build_ios), base.min_build_ios, 0, 999999),
    play_store_url: toText(map.get(SETTING_KEYS.play_store_url), base.play_store_url, 240),
    app_store_url: toText(map.get(SETTING_KEYS.app_store_url), base.app_store_url, 240),
    update_message: toText(map.get(SETTING_KEYS.update_message), base.update_message, 280),
    partner_force_update_enabled: toBool(
      map.get(SETTING_KEYS.partner_force_update_enabled),
      base.partner_force_update_enabled,
    ),
    partner_min_version_android: toVersion(
      map.get(SETTING_KEYS.partner_min_version_android),
      base.partner_min_version_android,
    ),
    partner_min_version_ios: toVersion(map.get(SETTING_KEYS.partner_min_version_ios), base.partner_min_version_ios),
    partner_min_build_android: toNumber(
      map.get(SETTING_KEYS.partner_min_build_android),
      base.partner_min_build_android,
      0,
      999999,
    ),
    partner_min_build_ios: toNumber(map.get(SETTING_KEYS.partner_min_build_ios), base.partner_min_build_ios, 0, 999999),
    partner_play_store_url: toText(map.get(SETTING_KEYS.partner_play_store_url), base.partner_play_store_url, 240),
    partner_app_store_url: toText(map.get(SETTING_KEYS.partner_app_store_url), base.partner_app_store_url, 240),
    partner_update_message: toText(map.get(SETTING_KEYS.partner_update_message), base.partner_update_message, 280),
  };
}

/** Partner 1.0.x builds shipped before the app query param. Customer releases start at 1.2. */
export function inferMobileAppKind(input: {
  app?: string | null;
  version?: string | null;
}): MobileAppKind {
  const explicit = String(input.app || '').trim().toLowerCase();
  if (explicit === 'partner' || explicit === 'customer') return explicit;
  const version = toVersion(input.version, '0.0.0');
  if (/^1\.0(?:\.|$)/.test(version)) return 'partner';
  return 'customer';
}

export async function getMobileAppVersionConfig(
  supabaseAdmin?: any,
  options?: { bypassCache?: boolean },
): Promise<MobileAppVersionConfig> {
  if (!options?.bypassCache && cached && Date.now() < cached.expiresAt) return cached.value;

  const admin = supabaseAdmin || getSupabaseAdmin().supabaseAdmin;
  if (!admin) {
    cached = { value: DEFAULT_MOBILE_APP_VERSION_CONFIG, expiresAt: Date.now() + 30_000 };
    return cached.value;
  }

  const { data } = await admin
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', Object.values(SETTING_KEYS));

  const map = new Map((data || []).map((row: any) => [String(row.setting_key), String(row.setting_value)]));
  const value = readConfigFromMap(map);

  cached = { value, expiresAt: Date.now() + 30_000 };
  return value;
}

export function evaluateForceUpdate(
  config: MobileAppVersionConfig,
  platform: MobilePlatform,
  currentVersion: string,
  currentBuild: number,
  app: MobileAppKind = 'customer',
): ForceUpdateEvaluation {
  const partner = app === 'partner';
  const minVersion = partner
    ? platform === 'android'
      ? config.partner_min_version_android
      : config.partner_min_version_ios
    : platform === 'android'
      ? config.min_version_android
      : config.min_version_ios;
  const minBuild = partner
    ? platform === 'android'
      ? config.partner_min_build_android
      : config.partner_min_build_ios
    : platform === 'android'
      ? config.min_build_android
      : config.min_build_ios;
  const storeUrl = partner
    ? platform === 'android'
      ? config.partner_play_store_url
      : config.partner_app_store_url
    : platform === 'android'
      ? config.play_store_url
      : config.app_store_url;
  const safeVersion = toVersion(currentVersion, '0.0.0');
  const safeBuild = toNumber(currentBuild, 0, 0, 999999);
  const enabled = partner ? config.partner_force_update_enabled : config.force_update_enabled;

  const versionTooOld = compareAppVersions(safeVersion, minVersion) < 0;
  const buildTooOld = safeBuild > 0 && minBuild > 0 && safeBuild < minBuild;
  const required = enabled && (versionTooOld || buildTooOld);

  return {
    required,
    app,
    platform,
    store_url: storeUrl,
    message: partner ? config.partner_update_message : config.update_message,
    min_version: minVersion,
    min_build: minBuild,
    current_version: safeVersion,
    current_build: safeBuild,
  };
}

export async function saveMobileAppVersionConfig(
  input: Partial<MobileAppVersionConfig>,
  updatedBy: string,
): Promise<{ ok: true; config: MobileAppVersionConfig } | { ok: false; error: string }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { ok: false, error: 'Database admin client unavailable' };
  }

  const existing = await getMobileAppVersionConfig(supabaseAdmin, { bypassCache: true });
  const next: MobileAppVersionConfig = {
    force_update_enabled:
      input.force_update_enabled === undefined ? existing.force_update_enabled : Boolean(input.force_update_enabled),
    min_version_android: toVersion(input.min_version_android, existing.min_version_android),
    min_version_ios: toVersion(input.min_version_ios, existing.min_version_ios),
    min_build_android: toNumber(
      input.min_build_android ?? existing.min_build_android,
      existing.min_build_android,
      0,
      999999,
    ),
    min_build_ios: toNumber(input.min_build_ios ?? existing.min_build_ios, existing.min_build_ios, 0, 999999),
    play_store_url: toText(input.play_store_url, existing.play_store_url, 240),
    app_store_url: toText(input.app_store_url, existing.app_store_url, 240),
    update_message: toText(input.update_message, existing.update_message, 280),
    partner_force_update_enabled:
      input.partner_force_update_enabled === undefined
        ? existing.partner_force_update_enabled
        : Boolean(input.partner_force_update_enabled),
    partner_min_version_android: toVersion(input.partner_min_version_android, existing.partner_min_version_android),
    partner_min_version_ios: toVersion(input.partner_min_version_ios, existing.partner_min_version_ios),
    partner_min_build_android: toNumber(
      input.partner_min_build_android ?? existing.partner_min_build_android,
      existing.partner_min_build_android,
      0,
      999999,
    ),
    partner_min_build_ios: toNumber(
      input.partner_min_build_ios ?? existing.partner_min_build_ios,
      existing.partner_min_build_ios,
      0,
      999999,
    ),
    partner_play_store_url: toText(input.partner_play_store_url, existing.partner_play_store_url, 240),
    partner_app_store_url: toText(input.partner_app_store_url, existing.partner_app_store_url, 240),
    partner_update_message: toText(input.partner_update_message, existing.partner_update_message, 280),
  };

  const now = new Date().toISOString();
  const rows: Array<{ key: string; value: string; type: 'BOOLEAN' | 'STRING' | 'NUMBER' }> = [
    { key: SETTING_KEYS.force_update_enabled, value: String(next.force_update_enabled), type: 'BOOLEAN' },
    { key: SETTING_KEYS.min_version_android, value: next.min_version_android, type: 'STRING' },
    { key: SETTING_KEYS.min_version_ios, value: next.min_version_ios, type: 'STRING' },
    { key: SETTING_KEYS.min_build_android, value: String(next.min_build_android), type: 'NUMBER' },
    { key: SETTING_KEYS.min_build_ios, value: String(next.min_build_ios), type: 'NUMBER' },
    { key: SETTING_KEYS.play_store_url, value: next.play_store_url, type: 'STRING' },
    { key: SETTING_KEYS.app_store_url, value: next.app_store_url, type: 'STRING' },
    { key: SETTING_KEYS.update_message, value: next.update_message, type: 'STRING' },
    { key: SETTING_KEYS.partner_force_update_enabled, value: String(next.partner_force_update_enabled), type: 'BOOLEAN' },
    { key: SETTING_KEYS.partner_min_version_android, value: next.partner_min_version_android, type: 'STRING' },
    { key: SETTING_KEYS.partner_min_version_ios, value: next.partner_min_version_ios, type: 'STRING' },
    { key: SETTING_KEYS.partner_min_build_android, value: String(next.partner_min_build_android), type: 'NUMBER' },
    { key: SETTING_KEYS.partner_min_build_ios, value: String(next.partner_min_build_ios), type: 'NUMBER' },
    { key: SETTING_KEYS.partner_play_store_url, value: next.partner_play_store_url, type: 'STRING' },
    { key: SETTING_KEYS.partner_app_store_url, value: next.partner_app_store_url, type: 'STRING' },
    { key: SETTING_KEYS.partner_update_message, value: next.partner_update_message, type: 'STRING' },
  ];

  for (const row of rows) {
    const { error } = await supabaseAdmin.from('system_settings').upsert(
      {
        setting_key: row.key,
        setting_value: row.value,
        setting_type: row.type,
        category: 'MOBILE',
        updated_at: now,
        updated_by: updatedBy,
      },
      { onConflict: 'setting_key' },
    );
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  cached = { value: next, expiresAt: Date.now() + 30_000 };
  return { ok: true, config: next };
}
