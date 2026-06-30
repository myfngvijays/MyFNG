import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const DEFAULT_WALLET_CONFIG = {
  WELCOME_BONUS_AMOUNT: 1000,
  WELCOME_BONUS_ENABLED: true,
  WELCOME_EXPIRY_DAYS: 90,
  SERVICE_USAGE_MODE: 'PERCENT' as const,
  SERVICE_USAGE_PERCENT: 0.1,
  SERVICE_USAGE_AMOUNT: 500,
  MEMBERSHIP_USAGE_MODE: 'PERCENT' as const,
  MEMBERSHIP_USAGE_PERCENT: 0.3,
  MEMBERSHIP_USAGE_AMOUNT: 210,
  WELCOME_SOURCE: 'WELCOME_BONUS',
  MEMBERSHIP_CASHBACK_SOURCE: 'MEMBERSHIP_CASHBACK',
  MEMBERSHIP_CASHBACK_RATE: 0.05,
  MEMBERSHIP_CASHBACK_MAX: 500,
  WALLET_ENABLED: true,
  MIN_PAYABLE_FOR_WALLET: 0,
  MAX_ABSOLUTE_DEDUCTION: 0,
  REFERRAL_FIRST_REWARD: 500,
  REFERRAL_REPEAT_REWARD: 250,
  REFERRAL_FRIEND_BONUS: 500,
  REFERRAL_EXPIRY_DAYS: 90,
} as const;

export type WalletPlatform = 'web' | 'android' | 'ios';

export type WalletUsageMode = 'PERCENT' | 'AMOUNT';

export type WalletRuntimeConfig = {
  WELCOME_BONUS_AMOUNT: number;
  WELCOME_BONUS_ENABLED: boolean;
  WELCOME_EXPIRY_DAYS: number;
  SERVICE_USAGE_MODE: WalletUsageMode;
  SERVICE_USAGE_PERCENT: number;
  SERVICE_USAGE_AMOUNT: number;
  MEMBERSHIP_USAGE_MODE: WalletUsageMode;
  MEMBERSHIP_USAGE_PERCENT: number;
  MEMBERSHIP_USAGE_AMOUNT: number;
  WELCOME_SOURCE: string;
  MEMBERSHIP_CASHBACK_SOURCE: string;
  MEMBERSHIP_CASHBACK_RATE: number;
  MEMBERSHIP_CASHBACK_MAX: number;
  WALLET_ENABLED: boolean;
  MIN_PAYABLE_FOR_WALLET: number;
  MAX_ABSOLUTE_DEDUCTION: number;
  REFERRAL_FIRST_REWARD: number;
  REFERRAL_REPEAT_REWARD: number;
  REFERRAL_FRIEND_BONUS: number;
  REFERRAL_EXPIRY_DAYS: number;
};

export type WalletCoreRules = {
  service_usage_mode: WalletUsageMode;
  service_usage_percent: number;
  service_usage_amount: number;
  membership_usage_mode: WalletUsageMode;
  membership_usage_percent: number;
  membership_usage_amount: number;
  welcome_bonus_enabled: boolean;
  welcome_bonus_amount: number;
  welcome_expiry_days: number;
  membership_cashback_rate_percent: number;
  membership_cashback_max: number;
};

/** @deprecated Use WalletCoreRules */
export type WalletLogicAdminPayload = WalletCoreRules;

export type WalletPlatformSettings = {
  use_global: boolean;
  enabled: boolean;
  rules: WalletCoreRules;
};

export type WalletRoadmapIdea = {
  id: string;
  title: string;
  desc: string;
  status: 'planned' | 'in_progress' | 'done';
};

export type WalletServiceOverride = {
  id: string;
  service_type_id: string;
  service_name: string;
  active: boolean;
  use_global: boolean;
  wallet_allowed: boolean;
  service_usage_mode: WalletUsageMode;
  service_usage_percent: number;
  service_usage_amount: number;
  membership_cashback_rate_percent: number;
  membership_cashback_max: number;
};

export type WalletLogicFullSettings = {
  global: WalletCoreRules;
  android: WalletPlatformSettings;
  ios: WalletPlatformSettings;
  referral_first_reward: number;
  referral_repeat_reward: number;
  referral_friend_bonus: number;
  referral_expiry_days: number;
  min_payable_for_wallet: number;
  max_absolute_deduction: number;
  roadmap_ideas: WalletRoadmapIdea[];
  advanced_enabled: boolean;
  service_overrides: WalletServiceOverride[];
};

const GLOBAL_KEYS = {
  service_usage_mode: 'wallet_service_usage_mode',
  service_usage_percent: 'wallet_service_usage_percent',
  service_usage_amount: 'wallet_service_usage_amount',
  membership_usage_mode: 'wallet_membership_usage_mode',
  membership_usage_percent: 'wallet_membership_usage_percent',
  membership_usage_amount: 'wallet_membership_usage_amount',
  welcome_bonus_enabled: 'wallet_welcome_bonus_enabled',
  welcome_bonus_amount: 'wallet_welcome_bonus_amount',
  welcome_expiry_days: 'wallet_welcome_expiry_days',
  membership_cashback_rate_percent: 'wallet_membership_cashback_rate_percent',
  membership_cashback_max: 'wallet_membership_cashback_max',
} as const;

const EXTRA_KEYS = {
  referral_first_reward: 'wallet_referral_first_reward',
  referral_repeat_reward: 'wallet_referral_repeat_reward',
  referral_friend_bonus: 'wallet_referral_friend_bonus',
  referral_expiry_days: 'wallet_referral_expiry_days',
  min_payable_for_wallet: 'wallet_min_payable_for_wallet',
  max_absolute_deduction: 'wallet_max_absolute_deduction',
} as const;

const PLATFORM_META_KEYS = (platform: 'android' | 'ios') =>
  ({
    use_global: `wallet_${platform}_use_global`,
    enabled: `wallet_${platform}_enabled`,
    service_usage_mode: `wallet_${platform}_service_usage_mode`,
    service_usage_percent: `wallet_${platform}_service_usage_percent`,
    service_usage_amount: `wallet_${platform}_service_usage_amount`,
    membership_usage_mode: `wallet_${platform}_membership_usage_mode`,
    membership_usage_percent: `wallet_${platform}_membership_usage_percent`,
    membership_usage_amount: `wallet_${platform}_membership_usage_amount`,
    welcome_bonus_enabled: `wallet_${platform}_welcome_bonus_enabled`,
    welcome_bonus_amount: `wallet_${platform}_welcome_bonus_amount`,
    welcome_expiry_days: `wallet_${platform}_welcome_expiry_days`,
    membership_cashback_rate_percent: `wallet_${platform}_membership_cashback_rate_percent`,
    membership_cashback_max: `wallet_${platform}_membership_cashback_max`,
  }) as const;

const DEFAULT_CORE_RULES: WalletCoreRules = {
  service_usage_mode: 'PERCENT',
  service_usage_percent: 10,
  service_usage_amount: 500,
  membership_usage_mode: 'PERCENT',
  membership_usage_percent: 30,
  membership_usage_amount: 210,
  welcome_bonus_enabled: true,
  welcome_bonus_amount: 1000,
  welcome_expiry_days: 90,
  membership_cashback_rate_percent: 5,
  membership_cashback_max: 500,
};

const ROADMAP_KEY = 'wallet_roadmap_ideas';
const SERVICE_OVERRIDES_KEY = 'wallet_service_overrides';
const ADVANCED_ENABLED_KEY = 'wallet_advanced_enabled';

export const DEFAULT_WALLET_ROADMAP: WalletRoadmapIdea[] = [
  { id: 'default-1', title: 'Festival bonus campaigns', desc: 'Time-bound extra wallet credits (Diwali, New Year)', status: 'planned' },
  { id: 'default-2', title: 'City-wise wallet caps', desc: 'Different % limits per zone or workshop', status: 'planned' },
  { id: 'default-3', title: 'Prime tier multipliers', desc: 'Gold vs Prime — higher cashback tiers', status: 'planned' },
  { id: 'default-4', title: 'RSA wallet usage', desc: 'Separate % for roadside assistance bookings', status: 'planned' },
  { id: 'default-5', title: 'Wallet + coupon stacking', desc: 'Control if wallet works with coupons together', status: 'planned' },
];

const DEFAULT_FULL_SETTINGS: WalletLogicFullSettings = {
  global: { ...DEFAULT_CORE_RULES },
  android: { use_global: true, enabled: true, rules: { ...DEFAULT_CORE_RULES } },
  ios: { use_global: true, enabled: true, rules: { ...DEFAULT_CORE_RULES } },
  referral_first_reward: 500,
  referral_repeat_reward: 250,
  referral_friend_bonus: 500,
  referral_expiry_days: 90,
  min_payable_for_wallet: 0,
  max_absolute_deduction: 0,
  roadmap_ideas: DEFAULT_WALLET_ROADMAP.map((item) => ({ ...item })),
  advanced_enabled: false,
  service_overrides: [],
};

let cached: { config: WalletRuntimeConfig; at: number; platform: WalletPlatform } | null = null;
const CACHE_MS = 30_000;

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value: unknown, fallback: boolean): boolean {
  if (value == null || value === '') return fallback;
  const s = String(value).toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return fallback;
}

function percentToDecimal(percent: number) {
  return Math.max(0, Math.min(100, percent)) / 100;
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

export function parseWalletPlatform(header?: string | null): WalletPlatform {
  const p = String(header || '').toLowerCase();
  if (p === 'android') return 'android';
  if (p === 'ios') return 'ios';
  return 'web';
}

export function clearWalletConfigCache() {
  cached = null;
}

function parseUsageMode(value: unknown, fallback: WalletUsageMode = 'PERCENT'): WalletUsageMode {
  return String(value || '').toUpperCase() === 'AMOUNT' ? 'AMOUNT' : fallback;
}

export function computeUsageCapFromRules(
  payableAmount: number,
  channel: 'SERVICE' | 'MEMBERSHIP',
  rules: Pick<
    WalletCoreRules,
    | 'service_usage_mode'
    | 'service_usage_percent'
    | 'service_usage_amount'
    | 'membership_usage_mode'
    | 'membership_usage_percent'
    | 'membership_usage_amount'
  >,
): number {
  if (payableAmount <= 0) return 0;
  const isMembership = channel === 'MEMBERSHIP';
  const mode = isMembership ? rules.membership_usage_mode : rules.service_usage_mode;
  if (mode === 'AMOUNT') {
    const fixed = isMembership ? rules.membership_usage_amount : rules.service_usage_amount;
    return Math.min(Math.max(0, fixed), payableAmount);
  }
  const pct = isMembership ? rules.membership_usage_percent : rules.service_usage_percent;
  return Math.min(payableAmount, payableAmount * (pct / 100));
}

export function formatUsageLimitLabel(
  rules: Pick<
    WalletCoreRules,
    | 'service_usage_mode'
    | 'service_usage_percent'
    | 'service_usage_amount'
    | 'membership_usage_mode'
    | 'membership_usage_percent'
    | 'membership_usage_amount'
  >,
  channel: 'SERVICE' | 'MEMBERSHIP',
): string {
  const isMembership = channel === 'MEMBERSHIP';
  const mode = isMembership ? rules.membership_usage_mode : rules.service_usage_mode;
  if (mode === 'AMOUNT') {
    const amt = isMembership ? rules.membership_usage_amount : rules.service_usage_amount;
    return `₹${Math.round(amt).toLocaleString('en-IN')}`;
  }
  const pct = isMembership ? rules.membership_usage_percent : rules.service_usage_percent;
  return `${pct}%`;
}

export function walletConfigToAdminPayload(config: WalletRuntimeConfig): WalletCoreRules {
  return {
    service_usage_mode: config.SERVICE_USAGE_MODE,
    service_usage_percent: roundPercent(config.SERVICE_USAGE_PERCENT * 100),
    service_usage_amount: config.SERVICE_USAGE_AMOUNT,
    membership_usage_mode: config.MEMBERSHIP_USAGE_MODE,
    membership_usage_percent: roundPercent(config.MEMBERSHIP_USAGE_PERCENT * 100),
    membership_usage_amount: config.MEMBERSHIP_USAGE_AMOUNT,
    welcome_bonus_enabled: config.WELCOME_BONUS_ENABLED !== false,
    welcome_bonus_amount: config.WELCOME_BONUS_AMOUNT,
    welcome_expiry_days: config.WELCOME_EXPIRY_DAYS,
    membership_cashback_rate_percent: roundPercent(config.MEMBERSHIP_CASHBACK_RATE * 100),
    membership_cashback_max: config.MEMBERSHIP_CASHBACK_MAX,
  };
}

export function coreRulesToRuntimeConfig(
  rules: WalletCoreRules,
  extras?: Partial<Pick<WalletRuntimeConfig, 'WALLET_ENABLED' | 'MIN_PAYABLE_FOR_WALLET' | 'MAX_ABSOLUTE_DEDUCTION' | 'REFERRAL_FIRST_REWARD' | 'REFERRAL_REPEAT_REWARD' | 'REFERRAL_FRIEND_BONUS' | 'REFERRAL_EXPIRY_DAYS'>>,
): WalletRuntimeConfig {
  return {
    WELCOME_BONUS_AMOUNT: rules.welcome_bonus_amount,
    WELCOME_BONUS_ENABLED: rules.welcome_bonus_enabled !== false,
    WELCOME_EXPIRY_DAYS: rules.welcome_expiry_days,
    SERVICE_USAGE_MODE: rules.service_usage_mode,
    SERVICE_USAGE_PERCENT: percentToDecimal(rules.service_usage_percent),
    SERVICE_USAGE_AMOUNT: rules.service_usage_amount,
    MEMBERSHIP_USAGE_MODE: rules.membership_usage_mode,
    MEMBERSHIP_USAGE_PERCENT: percentToDecimal(rules.membership_usage_percent),
    MEMBERSHIP_USAGE_AMOUNT: rules.membership_usage_amount,
    WELCOME_SOURCE: DEFAULT_WALLET_CONFIG.WELCOME_SOURCE,
    MEMBERSHIP_CASHBACK_SOURCE: DEFAULT_WALLET_CONFIG.MEMBERSHIP_CASHBACK_SOURCE,
    MEMBERSHIP_CASHBACK_RATE: percentToDecimal(rules.membership_cashback_rate_percent),
    MEMBERSHIP_CASHBACK_MAX: rules.membership_cashback_max,
    WALLET_ENABLED: extras?.WALLET_ENABLED ?? true,
    MIN_PAYABLE_FOR_WALLET: extras?.MIN_PAYABLE_FOR_WALLET ?? 0,
    MAX_ABSOLUTE_DEDUCTION: extras?.MAX_ABSOLUTE_DEDUCTION ?? 0,
    REFERRAL_FIRST_REWARD: extras?.REFERRAL_FIRST_REWARD ?? DEFAULT_WALLET_CONFIG.REFERRAL_FIRST_REWARD,
    REFERRAL_REPEAT_REWARD: extras?.REFERRAL_REPEAT_REWARD ?? DEFAULT_WALLET_CONFIG.REFERRAL_REPEAT_REWARD,
    REFERRAL_FRIEND_BONUS: extras?.REFERRAL_FRIEND_BONUS ?? DEFAULT_WALLET_CONFIG.REFERRAL_FRIEND_BONUS,
    REFERRAL_EXPIRY_DAYS: extras?.REFERRAL_EXPIRY_DAYS ?? DEFAULT_WALLET_CONFIG.REFERRAL_EXPIRY_DAYS,
  };
}

/** @deprecated */
export function adminPayloadToRuntimeConfig(payload: WalletCoreRules): WalletRuntimeConfig {
  return coreRulesToRuntimeConfig(payload);
}

function readCoreRules(map: Map<string, string>, keys: Record<string, string>, fallback: WalletCoreRules): WalletCoreRules {
  return {
    service_usage_mode: parseUsageMode(map.get(keys.service_usage_mode), fallback.service_usage_mode),
    service_usage_percent: toNumber(map.get(keys.service_usage_percent), fallback.service_usage_percent),
    service_usage_amount: toNumber(map.get(keys.service_usage_amount), fallback.service_usage_amount),
    membership_usage_mode: parseUsageMode(map.get(keys.membership_usage_mode), fallback.membership_usage_mode),
    membership_usage_percent: toNumber(map.get(keys.membership_usage_percent), fallback.membership_usage_percent),
    membership_usage_amount: toNumber(map.get(keys.membership_usage_amount), fallback.membership_usage_amount),
    welcome_bonus_enabled: toBool(map.get(keys.welcome_bonus_enabled), fallback.welcome_bonus_enabled),
    welcome_bonus_amount: toNumber(map.get(keys.welcome_bonus_amount), fallback.welcome_bonus_amount),
    welcome_expiry_days: toNumber(map.get(keys.welcome_expiry_days), fallback.welcome_expiry_days),
    membership_cashback_rate_percent: toNumber(
      map.get(keys.membership_cashback_rate_percent),
      fallback.membership_cashback_rate_percent,
    ),
    membership_cashback_max: toNumber(map.get(keys.membership_cashback_max), fallback.membership_cashback_max),
  };
}

function readPlatformSettings(
  map: Map<string, string>,
  platform: 'android' | 'ios',
  globalFallback: WalletCoreRules,
): WalletPlatformSettings {
  const keys = PLATFORM_META_KEYS(platform);
  return {
    use_global: toBool(map.get(keys.use_global), true),
    enabled: toBool(map.get(keys.enabled), true),
    rules: readCoreRules(map, keys, globalFallback),
  };
}

export function resolvePlatformCoreRules(
  settings: WalletLogicFullSettings,
  platform: WalletPlatform,
): WalletCoreRules {
  if (platform === 'android') {
    return settings.android.use_global ? settings.global : settings.android.rules;
  }
  if (platform === 'ios') {
    return settings.ios.use_global ? settings.global : settings.ios.rules;
  }
  return settings.global;
}

export function isWalletEnabledForPlatform(settings: WalletLogicFullSettings, platform: WalletPlatform): boolean {
  if (platform === 'android') return settings.android.enabled;
  if (platform === 'ios') return settings.ios.enabled;
  return true;
}

function allSettingKeys(): string[] {
  return [
    ...Object.values(GLOBAL_KEYS),
    ...Object.values(EXTRA_KEYS),
    ...Object.values(PLATFORM_META_KEYS('android')),
    ...Object.values(PLATFORM_META_KEYS('ios')),
    ROADMAP_KEY,
    SERVICE_OVERRIDES_KEY,
    ADVANCED_ENABLED_KEY,
  ];
}

export function parseServiceOverrides(raw: unknown): WalletServiceOverride[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' && raw.trim() ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : [];
  if (!Array.isArray(list)) return [];

  return list
    .map((item, index) => ({
      id: String((item as any)?.id || `svc-${index}`),
      service_type_id: String((item as any)?.service_type_id || ''),
      service_name: String((item as any)?.service_name || 'Service'),
      active: (item as any)?.active !== false,
      use_global: (item as any)?.use_global !== false,
      wallet_allowed: (item as any)?.wallet_allowed !== false,
      service_usage_mode: parseUsageMode((item as any)?.service_usage_mode, 'PERCENT'),
      service_usage_percent: toNumber((item as any)?.service_usage_percent, 10),
      service_usage_amount: toNumber((item as any)?.service_usage_amount, 500),
      membership_cashback_rate_percent: toNumber((item as any)?.membership_cashback_rate_percent, 5),
      membership_cashback_max: toNumber((item as any)?.membership_cashback_max, 500),
    }))
    .filter((item) => item.service_type_id);
}

export function resolveServiceWalletConfig(
  baseConfig: WalletRuntimeConfig,
  settings: WalletLogicFullSettings,
  serviceTypeId?: string | null,
): WalletRuntimeConfig {
  if (!settings.advanced_enabled || !serviceTypeId) return baseConfig;

  const override = (settings.service_overrides || []).find(
    (row) => row.active && row.service_type_id === serviceTypeId,
  );
  if (!override) return baseConfig;

  if (!override.wallet_allowed) {
    return {
      ...baseConfig,
      WALLET_ENABLED: false,
      SERVICE_USAGE_PERCENT: 0,
      SERVICE_USAGE_AMOUNT: 0,
    };
  }

  if (override.use_global) return baseConfig;

  return {
    ...baseConfig,
    SERVICE_USAGE_MODE: override.service_usage_mode,
    SERVICE_USAGE_PERCENT: percentToDecimal(override.service_usage_percent),
    SERVICE_USAGE_AMOUNT: override.service_usage_amount,
    MEMBERSHIP_CASHBACK_RATE: percentToDecimal(override.membership_cashback_rate_percent),
    MEMBERSHIP_CASHBACK_MAX: override.membership_cashback_max,
  };
}

export function parseRoadmapIdeas(raw: unknown): WalletRoadmapIdea[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item, index) => ({
        id: String((item as any)?.id || `idea-${index}`),
        title: String((item as any)?.title || '').trim(),
        desc: String((item as any)?.desc || '').trim(),
        status: (['planned', 'in_progress', 'done'].includes(String((item as any)?.status))
          ? String((item as any)?.status)
          : 'planned') as WalletRoadmapIdea['status'],
      }))
      .filter((item) => item.title.length > 0);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return parseRoadmapIdeas(JSON.parse(raw));
    } catch {
      return DEFAULT_WALLET_ROADMAP.map((item) => ({ ...item }));
    }
  }
  return DEFAULT_WALLET_ROADMAP.map((item) => ({ ...item }));
}

export function createDefaultWalletLogicSettings(): WalletLogicFullSettings {
  return JSON.parse(JSON.stringify(DEFAULT_FULL_SETTINGS)) as WalletLogicFullSettings;
}

export async function getWalletLogicSettings(supabaseAdmin?: any): Promise<WalletLogicFullSettings> {
  const admin = supabaseAdmin || getSupabaseAdmin().supabaseAdmin;
  if (!admin) return createDefaultWalletLogicSettings();

  const { data } = await admin
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', allSettingKeys());

  const map = new Map((data || []).map((row: any) => [String(row.setting_key), String(row.setting_value)]));

  const global = readCoreRules(map, GLOBAL_KEYS, DEFAULT_CORE_RULES);

  return {
    global,
    android: readPlatformSettings(map, 'android', global),
    ios: readPlatformSettings(map, 'ios', global),
    referral_first_reward: toNumber(map.get(EXTRA_KEYS.referral_first_reward), 500),
    referral_repeat_reward: toNumber(map.get(EXTRA_KEYS.referral_repeat_reward), 250),
    referral_friend_bonus: toNumber(map.get(EXTRA_KEYS.referral_friend_bonus), 500),
    referral_expiry_days: toNumber(map.get(EXTRA_KEYS.referral_expiry_days), 90),
    min_payable_for_wallet: toNumber(map.get(EXTRA_KEYS.min_payable_for_wallet), 0),
    max_absolute_deduction: toNumber(map.get(EXTRA_KEYS.max_absolute_deduction), 0),
    roadmap_ideas: parseRoadmapIdeas(map.get(ROADMAP_KEY)),
    advanced_enabled: toBool(map.get(ADVANCED_ENABLED_KEY), false),
    service_overrides: parseServiceOverrides(map.get(SERVICE_OVERRIDES_KEY)),
  };
}

export async function getWalletConfig(
  supabaseAdmin?: any,
  platform: WalletPlatform = 'web',
): Promise<WalletRuntimeConfig> {
  if (cached && Date.now() - cached.at < CACHE_MS && cached.platform === platform) {
    return cached.config;
  }

  const settings = await getWalletLogicSettings(supabaseAdmin);
  const core = resolvePlatformCoreRules(settings, platform);
  const enabled = isWalletEnabledForPlatform(settings, platform);

  const config = coreRulesToRuntimeConfig(core, {
    WALLET_ENABLED: enabled,
    MIN_PAYABLE_FOR_WALLET: settings.min_payable_for_wallet,
    MAX_ABSOLUTE_DEDUCTION: settings.max_absolute_deduction,
    REFERRAL_FIRST_REWARD: settings.referral_first_reward,
    REFERRAL_REPEAT_REWARD: settings.referral_repeat_reward,
    REFERRAL_FRIEND_BONUS: settings.referral_friend_bonus,
    REFERRAL_EXPIRY_DAYS: settings.referral_expiry_days,
  });

  cached = { config, at: Date.now(), platform };
  return config;
}

export function validateCoreRules(input: Partial<WalletCoreRules>, label = 'Rule'): string | null {
  const serviceMode = input.service_usage_mode || 'PERCENT';
  const membershipMode = input.membership_usage_mode || 'PERCENT';
  if (serviceMode !== 'PERCENT' && serviceMode !== 'AMOUNT') {
    return `${label}: service usage mode must be PERCENT or AMOUNT`;
  }
  if (membershipMode !== 'PERCENT' && membershipMode !== 'AMOUNT') {
    return `${label}: membership usage mode must be PERCENT or AMOUNT`;
  }

  const checks: Array<[keyof WalletCoreRules, number, number]> = [
    ...(serviceMode === 'PERCENT'
      ? ([['service_usage_percent', 0, 100]] as const)
      : ([['service_usage_amount', 0, 100000]] as const)),
    ...(membershipMode === 'PERCENT'
      ? ([['membership_usage_percent', 0, 100]] as const)
      : ([['membership_usage_amount', 0, 100000]] as const)),
    ['welcome_bonus_amount', 0, 100000],
    ['welcome_expiry_days', 1, 3650],
    ['membership_cashback_rate_percent', 0, 100],
    ['membership_cashback_max', 0, 100000],
  ];

  for (const [key, min, max] of checks) {
    const value = input[key];
    if (value == null || value === '') return `${label}: ${key.replace(/_/g, ' ')} is required`;
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) {
      return `${label}: ${key.replace(/_/g, ' ')} must be between ${min} and ${max}`;
    }
  }
  return null;
}

export function validateWalletLogicPayload(input: Partial<WalletCoreRules>): string | null {
  return validateCoreRules(input, 'Global');
}

export function validateWalletLogicFullSettings(input: Partial<WalletLogicFullSettings>): string | null {
  if (!input.global) return 'Global rules are required';
  const globalErr = validateCoreRules(input.global, 'Default (Web)');
  if (globalErr) return globalErr;

  if (input.android && !input.android.use_global) {
    const err = validateCoreRules(input.android.rules, 'Android');
    if (err) return err;
  }
  if (input.ios && !input.ios.use_global) {
    const err = validateCoreRules(input.ios.rules, 'iOS');
    if (err) return err;
  }

  const extraChecks: Array<[keyof Pick<WalletLogicFullSettings, 'referral_first_reward' | 'referral_repeat_reward' | 'referral_friend_bonus' | 'referral_expiry_days' | 'min_payable_for_wallet' | 'max_absolute_deduction'>, number, number]> = [
    ['referral_first_reward', 0, 100000],
    ['referral_repeat_reward', 0, 100000],
    ['referral_friend_bonus', 0, 100000],
    ['referral_expiry_days', 1, 3650],
    ['min_payable_for_wallet', 0, 1000000],
    ['max_absolute_deduction', 0, 1000000],
  ];

  for (const [key, min, max] of extraChecks) {
    const value = input[key];
    if (value == null || value === '') return `${key.replace(/_/g, ' ')} is required`;
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) {
      return `${key.replace(/_/g, ' ')} must be between ${min} and ${max}`;
    }
  }

  for (const idea of input.roadmap_ideas || []) {
    if (!String(idea.title || '').trim()) return 'Each roadmap idea needs a title';
  }

  const seenServiceIds = new Set<string>();
  for (const row of input.service_overrides || []) {
    if (!String(row.service_type_id || '').trim()) return 'Each service override needs a service';
    if (seenServiceIds.has(row.service_type_id)) {
      return `Duplicate service rule: ${row.service_name || row.service_type_id}`;
    }
    seenServiceIds.add(row.service_type_id);
    if (!row.use_global) {
      const mode = row.service_usage_mode || 'PERCENT';
      if (mode === 'PERCENT') {
        if (row.service_usage_percent < 0 || row.service_usage_percent > 100) {
          return `${row.service_name}: service % must be 0–100`;
        }
      } else if (row.service_usage_amount < 0 || row.service_usage_amount > 100000) {
        return `${row.service_name}: service fixed amount must be 0–100000`;
      }
      if (row.membership_cashback_rate_percent < 0 || row.membership_cashback_rate_percent > 100) {
        return `${row.service_name}: cashback % must be 0–100`;
      }
      if (row.membership_cashback_max < 0 || row.membership_cashback_max > 100000) {
        return `${row.service_name}: max cashback must be 0–100000`;
      }
    }
  }

  return null;
}

async function upsertSetting(
  supabaseAdmin: any,
  key: string,
  value: string,
  type: 'NUMBER' | 'BOOLEAN' | 'JSON' | 'STRING',
  updatedBy?: string | null,
) {
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: key,
      setting_value: value,
      setting_type: type,
      category: 'WALLET',
      is_editable: true,
      updated_by: updatedBy || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  if (error) throw error;
}

export async function saveWalletLogicSettings(
  supabaseAdmin: any,
  payload: WalletLogicFullSettings,
  updatedBy?: string | null,
) {
  const error = validateWalletLogicFullSettings(payload);
  if (error) throw new Error(error);

  const modeFields = new Set(['service_usage_mode', 'membership_usage_mode']);
  const booleanFields = new Set(['welcome_bonus_enabled']);

  for (const [field, key] of Object.entries(GLOBAL_KEYS)) {
    await upsertSetting(
      supabaseAdmin,
      key,
      String(payload.global[field as keyof WalletCoreRules]),
      modeFields.has(field) ? 'STRING' : booleanFields.has(field) ? 'BOOLEAN' : 'NUMBER',
      updatedBy,
    );
  }

  for (const [field, key] of Object.entries(EXTRA_KEYS)) {
    await upsertSetting(supabaseAdmin, key, String(payload[field as keyof typeof EXTRA_KEYS]), 'NUMBER', updatedBy);
  }

  for (const platform of ['android', 'ios'] as const) {
    const keys = PLATFORM_META_KEYS(platform);
    const section = payload[platform];
    await upsertSetting(supabaseAdmin, keys.use_global, String(section.use_global), 'BOOLEAN', updatedBy);
    await upsertSetting(supabaseAdmin, keys.enabled, String(section.enabled), 'BOOLEAN', updatedBy);
    for (const [field, key] of Object.entries(keys)) {
      if (field === 'use_global' || field === 'enabled') continue;
      await upsertSetting(
        supabaseAdmin,
        key,
        String(section.rules[field as keyof WalletCoreRules]),
        modeFields.has(field) ? 'STRING' : booleanFields.has(field) ? 'BOOLEAN' : 'NUMBER',
        updatedBy,
      );
    }
  }

  await upsertSetting(
    supabaseAdmin,
    ROADMAP_KEY,
    JSON.stringify(payload.roadmap_ideas || []),
    'JSON',
    updatedBy,
  );

  await upsertSetting(
    supabaseAdmin,
    ADVANCED_ENABLED_KEY,
    String(Boolean(payload.advanced_enabled)),
    'BOOLEAN',
    updatedBy,
  );

  await upsertSetting(
    supabaseAdmin,
    SERVICE_OVERRIDES_KEY,
    JSON.stringify(payload.service_overrides || []),
    'JSON',
    updatedBy,
  );

  clearWalletConfigCache();
  return payload;
}

/** @deprecated Use saveWalletLogicSettings with full payload */
export async function saveWalletLogicSettingsLegacy(
  supabaseAdmin: any,
  payload: WalletCoreRules,
  updatedBy?: string | null,
) {
  const current = await getWalletLogicSettings(supabaseAdmin);
  current.global = payload;
  return saveWalletLogicSettings(supabaseAdmin, current, updatedBy);
}

export function walletRulesToPublicPayload(
  config: WalletRuntimeConfig,
  settings?: WalletLogicFullSettings,
) {
  return {
    success: true,
    wallet_enabled: config.WALLET_ENABLED,
    service_usage_mode: config.SERVICE_USAGE_MODE,
    service_usage_percent: config.SERVICE_USAGE_PERCENT * 100,
    service_usage_amount: config.SERVICE_USAGE_AMOUNT,
    membership_usage_mode: config.MEMBERSHIP_USAGE_MODE,
    membership_usage_percent: config.MEMBERSHIP_USAGE_PERCENT * 100,
    membership_usage_amount: config.MEMBERSHIP_USAGE_AMOUNT,
    welcome_bonus_enabled: config.WELCOME_BONUS_ENABLED !== false,
    welcome_bonus_amount: config.WELCOME_BONUS_AMOUNT,
    welcome_expiry_days: config.WELCOME_EXPIRY_DAYS,
    membership_cashback_rate_percent: config.MEMBERSHIP_CASHBACK_RATE * 100,
    membership_cashback_max: config.MEMBERSHIP_CASHBACK_MAX,
    referral_first_reward: config.REFERRAL_FIRST_REWARD,
    referral_repeat_reward: config.REFERRAL_REPEAT_REWARD,
    referral_friend_bonus: config.REFERRAL_FRIEND_BONUS,
    referral_expiry_days: config.REFERRAL_EXPIRY_DAYS,
    min_payable_for_wallet: config.MIN_PAYABLE_FOR_WALLET,
    max_absolute_deduction: config.MAX_ABSOLUTE_DEDUCTION,
    advanced_enabled: Boolean(settings?.advanced_enabled),
    service_overrides: settings?.advanced_enabled
      ? (settings.service_overrides || []).filter((row) => row.active)
      : [],
  };
}
