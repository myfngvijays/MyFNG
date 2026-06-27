import { ENV } from '../config/environment';
import { supabase } from './supabase';
import {
  DEFAULT_APP_FOOTER_CONFIG,
  DEFAULT_APP_FOOTER_TRUST_GRID,
  type AppFooterConfig,
  type AppFooterTrustGrid,
} from './appFooterConfigDefaults';

export type { AppFooterConfig };
export { DEFAULT_APP_FOOTER_CONFIG };

const FOOTER_SETTING_KEYS = {
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

let cached: AppFooterConfig | null = null;
let cachedAt = 0;
let inflight: Promise<AppFooterConfig> | null = null;

function pickTrustGrid(raw: any, map?: Map<string, string>): AppFooterTrustGrid {
  const base = DEFAULT_APP_FOOTER_TRUST_GRID;
  const grid = Array.isArray(raw?.trust_grid) ? raw.trust_grid : [];
  const trustKeys = [
    [FOOTER_SETTING_KEYS.trust1_value, FOOTER_SETTING_KEYS.trust1_label],
    [FOOTER_SETTING_KEYS.trust2_value, FOOTER_SETTING_KEYS.trust2_label],
    [FOOTER_SETTING_KEYS.trust3_value, FOOTER_SETTING_KEYS.trust3_label],
    [FOOTER_SETTING_KEYS.trust4_value, FOOTER_SETTING_KEYS.trust4_label],
  ] as const;

  return [0, 1, 2, 3].map((index) => {
    const [valueKey, labelKey] = trustKeys[index];
    return {
      value:
        String(grid[index]?.value || map?.get(valueKey) || base[index].value).trim() || base[index].value,
      label:
        String(grid[index]?.label || map?.get(labelKey) || base[index].label).trim() || base[index].label,
    };
  }) as AppFooterTrustGrid;
}

function resolveBottomLine(raw: any, map?: Map<string, string>): string {
  const base = DEFAULT_APP_FOOTER_CONFIG;
  if (raw?.bottom_line != null) {
    return String(raw.bottom_line).trim() || base.bottom_line;
  }
  if (map?.has(FOOTER_SETTING_KEYS.bottom_line)) {
    return String(map.get(FOOTER_SETTING_KEYS.bottom_line) || '').trim() || base.bottom_line;
  }

  const stats = Array.isArray(raw?.stats) ? raw.stats : [];
  if (stats[2]?.value || stats[2]?.label) {
    return `${stats[2]?.value || ''} ${String(stats[2]?.label || '').replace(/\n/g, ' ')}`.trim() || base.bottom_line;
  }

  const legacyValue = map?.get(FOOTER_SETTING_KEYS.stat3_value_legacy);
  const legacyLabel = map?.get(FOOTER_SETTING_KEYS.stat3_label_legacy);
  if (legacyValue || legacyLabel) {
    return `${legacyValue || ''} ${String(legacyLabel || '').replace(/\n/g, ' ')}`.trim() || base.bottom_line;
  }

  return base.bottom_line;
}

function normalizeConfig(raw: any, map?: Map<string, string>): AppFooterConfig {
  const base = DEFAULT_APP_FOOTER_CONFIG;
  const stats = Array.isArray(raw?.stats) ? raw.stats : null;

  return {
    headline_line1:
      String(raw?.headline_line1 || map?.get(FOOTER_SETTING_KEYS.headline_line1) || base.headline_line1).trim() ||
      base.headline_line1,
    headline_line2:
      String(raw?.headline_line2 || map?.get(FOOTER_SETTING_KEYS.headline_line2) || base.headline_line2).trim() ||
      base.headline_line2,
    stats: [0, 1].map((i) => ({
      value:
        String(
          stats?.[i]?.value ||
            map?.get(i === 0 ? FOOTER_SETTING_KEYS.stat1_value : FOOTER_SETTING_KEYS.stat2_value) ||
            base.stats[i as 0 | 1].value,
        ).trim() || base.stats[i as 0 | 1].value,
      label:
        String(
          stats?.[i]?.label ||
            map?.get(i === 0 ? FOOTER_SETTING_KEYS.stat1_label : FOOTER_SETTING_KEYS.stat2_label) ||
            base.stats[i as 0 | 1].label,
        ).trim() || base.stats[i as 0 | 1].label,
    })) as AppFooterConfig['stats'],
    trust_grid: pickTrustGrid(raw, map),
    bottom_line: resolveBottomLine(raw, map),
  };
}

function settingsMapFromRpc(payload: unknown): Map<string, string> | null {
  if (!payload || typeof payload !== 'object') return null;
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    map.set(String(key), String(value ?? '').trim());
  }
  return map.size > 0 ? map : null;
}

async function fetchAppFooterConfigFromApi(): Promise<AppFooterConfig | null> {
  try {
    const res = await fetch(`${ENV.API_URL}/api/public/app-footer/config?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    });
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || !contentType.includes('application/json')) return null;

    const json = await res.json().catch(() => null);
    if (!json?.config || typeof json.config !== 'object') return null;
    return normalizeConfig(json.config);
  } catch {
    return null;
  }
}

async function fetchAppFooterConfigFromSupabase(): Promise<AppFooterConfig | null> {
  try {
    const { data, error } = await supabase.rpc('get_public_app_footer_config');
    if (error || !data) return null;

    const map = settingsMapFromRpc(data);
    if (!map) return null;
    return normalizeConfig({}, map);
  } catch {
    return null;
  }
}

export function invalidateAppFooterConfigCache() {
  cached = null;
  cachedAt = 0;
  inflight = null;
}

export async function fetchAppFooterConfig(force = false): Promise<AppFooterConfig> {
  if (!force && cached && Date.now() - cachedAt < 60_000) return cached;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    const fromApi = await fetchAppFooterConfigFromApi();
    if (fromApi) return fromApi;

    const fromSupabase = await fetchAppFooterConfigFromSupabase();
    if (fromSupabase) return fromSupabase;

    return DEFAULT_APP_FOOTER_CONFIG;
  })()
    .then((value) => {
      cached = value;
      cachedAt = Date.now();
      inflight = null;
      return value;
    })
    .catch(() => {
      inflight = null;
      cached = DEFAULT_APP_FOOTER_CONFIG;
      cachedAt = Date.now();
      return DEFAULT_APP_FOOTER_CONFIG;
    });

  return inflight;
}
