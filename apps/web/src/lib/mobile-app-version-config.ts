import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export type MobilePlatform = 'android' | 'ios';

export type MobileAppVersionConfig = {
  force_update_enabled: boolean;
  min_version_android: string;
  min_version_ios: string;
  min_build_android: number;
  min_build_ios: number;
  play_store_url: string;
  app_store_url: string;
  update_message: string;
};

export type ForceUpdateEvaluation = {
  required: boolean;
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

export const DEFAULT_MOBILE_APP_VERSION_CONFIG: MobileAppVersionConfig = {
  force_update_enabled: true,
  min_version_android: '1.2.0',
  min_version_ios: '1.2.0',
  min_build_android: 23,
  min_build_ios: 23,
  play_store_url: DEFAULT_PLAY_STORE_URL,
  app_store_url: DEFAULT_APP_STORE_URL,
  update_message: DEFAULT_FORCE_UPDATE_MESSAGE,
};

const SETTING_KEYS = {
  force_update_enabled: 'mobile_app_force_update_enabled',
  min_version_android: 'mobile_app_min_version_android',
  min_version_ios: 'mobile_app_min_version_ios',
  min_build_android: 'mobile_app_min_build_android',
  min_build_ios: 'mobile_app_min_build_ios',
  play_store_url: 'mobile_app_play_store_url',
  app_store_url: 'mobile_app_app_store_url',
  update_message: 'mobile_app_force_update_message',
} as const;

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
  };
}

export async function getMobileAppVersionConfig(
  supabaseAdmin?: any,
): Promise<MobileAppVersionConfig> {
  if (cached && Date.now() < cached.expiresAt) return cached.value;

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
): ForceUpdateEvaluation {
  const minVersion =
    platform === 'android' ? config.min_version_android : config.min_version_ios;
  const minBuild = platform === 'android' ? config.min_build_android : config.min_build_ios;
  const storeUrl = platform === 'android' ? config.play_store_url : config.app_store_url;
  const safeVersion = toVersion(currentVersion, '0.0.0');
  const safeBuild = toNumber(currentBuild, 0, 0, 999999);

  const versionTooOld = compareAppVersions(safeVersion, minVersion) < 0;
  const buildTooOld = safeBuild > 0 && minBuild > 0 && safeBuild < minBuild;
  const required = config.force_update_enabled && (versionTooOld || buildTooOld);

  return {
    required,
    platform,
    store_url: storeUrl,
    message: config.update_message,
    min_version: minVersion,
    min_build: minBuild,
    current_version: safeVersion,
    current_build: safeBuild,
  };
}
