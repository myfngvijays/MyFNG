import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export type AppFooterStat = {
  value: string;
  label: string;
};

export type AppFooterTrustGrid = [
  AppFooterStat,
  AppFooterStat,
  AppFooterStat,
  AppFooterStat,
];

export type AppFooterConfig = {
  headline_line1: string;
  headline_line2: string;
  stats: [AppFooterStat, AppFooterStat];
  trust_grid: AppFooterTrustGrid;
  bottom_line: string;
};

export const DEFAULT_APP_FOOTER_TRUST_GRID: AppFooterTrustGrid = [
  { value: '17K+', label: 'Cars Serviced' },
  { value: '4.8', label: 'Reviews' },
  { value: '100+', label: 'Workshops' },
  { value: '24/7', label: 'Support' },
];

export const DEFAULT_APP_FOOTER_CONFIG: AppFooterConfig = {
  headline_line1: "India's #1 AI-Powered",
  headline_line2: 'Car Service Booking Platform',
  stats: [
    { value: '17k+', label: 'Car Serviced' },
    { value: '4.8', label: 'Top-Rated' },
  ],
  trust_grid: DEFAULT_APP_FOOTER_TRUST_GRID,
  bottom_line: '100+ A-GRADE MULTIBRAND WORKSHOPS',
};

const SETTING_KEYS = {
  headline_line1: 'app_footer_headline_line1',
  headline_line2: 'app_footer_headline_line2',
  stat1_value: 'app_footer_stat1_value',
  stat1_label: 'app_footer_stat1_label',
  stat2_value: 'app_footer_stat2_value',
  stat2_label: 'app_footer_stat2_label',
  bottom_line: 'app_footer_bottom_line',
  stat3_value_legacy: 'app_footer_stat3_value',
  stat3_label_legacy: 'app_footer_stat3_label',
  trust1_value: 'app_footer_trust1_value',
  trust1_label: 'app_footer_trust1_label',
  trust2_value: 'app_footer_trust2_value',
  trust2_label: 'app_footer_trust2_label',
  trust3_value: 'app_footer_trust3_value',
  trust3_label: 'app_footer_trust3_label',
  trust4_value: 'app_footer_trust4_value',
  trust4_label: 'app_footer_trust4_label',
} as const;

const TRUST_GRID_SETTING_KEYS = [
  [SETTING_KEYS.trust1_value, SETTING_KEYS.trust1_label],
  [SETTING_KEYS.trust2_value, SETTING_KEYS.trust2_label],
  [SETTING_KEYS.trust3_value, SETTING_KEYS.trust3_label],
  [SETTING_KEYS.trust4_value, SETTING_KEYS.trust4_label],
] as const;

let cached: { value: AppFooterConfig; expiresAt: number } | null = null;

function toText(value: unknown, fallback: string, maxLen: number): string {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.slice(0, maxLen);
}

export function clearAppFooterConfigCache() {
  cached = null;
}

function pickStats(input?: Partial<AppFooterConfig> | null): [AppFooterStat, AppFooterStat] {
  const base = DEFAULT_APP_FOOTER_CONFIG;
  const statsInput = Array.isArray(input?.stats) ? input.stats : [];
  const pickStat = (index: 0 | 1) => ({
    value: toText(statsInput[index]?.value, base.stats[index].value, 24),
    label: toText(statsInput[index]?.label, base.stats[index].label, 40),
  });
  return [pickStat(0), pickStat(1)];
}

function pickTrustGrid(input?: Partial<AppFooterConfig> | null, map?: Map<string, string>): AppFooterTrustGrid {
  const base = DEFAULT_APP_FOOTER_CONFIG;
  const gridInput = Array.isArray(input?.trust_grid) ? input.trust_grid : [];
  return [0, 1, 2, 3].map((index) => {
    const [valueKey, labelKey] = TRUST_GRID_SETTING_KEYS[index];
    return {
      value: toText(
        gridInput[index]?.value ?? map?.get(valueKey),
        base.trust_grid[index].value,
        24,
      ),
      label: toText(
        gridInput[index]?.label ?? map?.get(labelKey),
        base.trust_grid[index].label,
        40,
      ),
    };
  }) as AppFooterTrustGrid;
}

function resolveBottomLine(input?: Partial<AppFooterConfig> | null, map?: Map<string, string>): string {
  const base = DEFAULT_APP_FOOTER_CONFIG;
  if (input?.bottom_line != null) {
    return toText(input.bottom_line, base.bottom_line, 80);
  }
  if (map?.has(SETTING_KEYS.bottom_line)) {
    return toText(map.get(SETTING_KEYS.bottom_line), base.bottom_line, 80);
  }

  const statsInput = Array.isArray(input?.stats) ? input.stats : [];
  if (statsInput[2]?.value || statsInput[2]?.label) {
    return toText(
      `${statsInput[2]?.value || ''} ${String(statsInput[2]?.label || '').replace(/\n/g, ' ')}`.trim(),
      base.bottom_line,
      80,
    );
  }

  const legacyValue = map?.get(SETTING_KEYS.stat3_value_legacy);
  const legacyLabel = map?.get(SETTING_KEYS.stat3_label_legacy);
  if (legacyValue || legacyLabel) {
    return toText(
      `${legacyValue || ''} ${String(legacyLabel || '').replace(/\n/g, ' ')}`.trim(),
      base.bottom_line,
      80,
    );
  }

  return base.bottom_line;
}

export function normalizeAppFooterConfig(input?: Partial<AppFooterConfig> | null): AppFooterConfig {
  return {
    headline_line1: toText(input?.headline_line1, DEFAULT_APP_FOOTER_CONFIG.headline_line1, 80),
    headline_line2: toText(input?.headline_line2, DEFAULT_APP_FOOTER_CONFIG.headline_line2, 80),
    stats: pickStats(input),
    trust_grid: pickTrustGrid(input),
    bottom_line: resolveBottomLine(input),
  };
}

function readConfigFromMap(map: Map<string, string>): AppFooterConfig {
  const base = DEFAULT_APP_FOOTER_CONFIG;
  return normalizeAppFooterConfig({
    headline_line1: map.get(SETTING_KEYS.headline_line1) || base.headline_line1,
    headline_line2: map.get(SETTING_KEYS.headline_line2) || base.headline_line2,
    stats: [
      {
        value: map.get(SETTING_KEYS.stat1_value) || base.stats[0].value,
        label: map.get(SETTING_KEYS.stat1_label) || base.stats[0].label,
      },
      {
        value: map.get(SETTING_KEYS.stat2_value) || base.stats[1].value,
        label: map.get(SETTING_KEYS.stat2_label) || base.stats[1].label,
      },
    ],
    trust_grid: pickTrustGrid(undefined, map),
    bottom_line: resolveBottomLine(undefined, map),
  });
}

export async function getAppFooterConfig(supabaseAdmin?: any): Promise<AppFooterConfig> {
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const admin = supabaseAdmin || getSupabaseAdmin().supabaseAdmin;
  if (!admin) {
    cached = { value: DEFAULT_APP_FOOTER_CONFIG, expiresAt: Date.now() + 30_000 };
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

async function upsertSetting(
  supabaseAdmin: any,
  key: string,
  value: string,
  updatedBy?: string | null,
) {
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: key,
      setting_value: value,
      setting_type: 'STRING',
      category: 'APP',
      description: 'Mobile app footer content',
      updated_by: updatedBy || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  if (error) throw new Error(error.message || `Could not save ${key}`);
}

export async function saveAppFooterConfig(
  supabaseAdmin: any,
  input: Partial<AppFooterConfig>,
  updatedBy?: string | null,
): Promise<AppFooterConfig> {
  const next = normalizeAppFooterConfig(input);
  next.trust_grid[0] = { ...next.trust_grid[0], value: next.stats[0].value, label: next.stats[0].label };
  next.trust_grid[1] = { ...next.trust_grid[1], value: next.stats[1].value, label: next.stats[1].label };

  await upsertSetting(supabaseAdmin, SETTING_KEYS.headline_line1, next.headline_line1, updatedBy);
  await upsertSetting(supabaseAdmin, SETTING_KEYS.headline_line2, next.headline_line2, updatedBy);
  await upsertSetting(supabaseAdmin, SETTING_KEYS.stat1_value, next.stats[0].value, updatedBy);
  await upsertSetting(supabaseAdmin, SETTING_KEYS.stat1_label, next.stats[0].label, updatedBy);
  await upsertSetting(supabaseAdmin, SETTING_KEYS.stat2_value, next.stats[1].value, updatedBy);
  await upsertSetting(supabaseAdmin, SETTING_KEYS.stat2_label, next.stats[1].label, updatedBy);
  for (let i = 0; i < next.trust_grid.length; i += 1) {
    const [valueKey, labelKey] = TRUST_GRID_SETTING_KEYS[i];
    await upsertSetting(supabaseAdmin, valueKey, next.trust_grid[i].value, updatedBy);
    await upsertSetting(supabaseAdmin, labelKey, next.trust_grid[i].label, updatedBy);
  }
  await upsertSetting(supabaseAdmin, SETTING_KEYS.bottom_line, next.bottom_line, updatedBy);

  clearAppFooterConfigCache();
  return next;
}
