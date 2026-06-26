import { ENV } from '../config/environment';
import {
  DEFAULT_APP_FOOTER_CONFIG,
  DEFAULT_APP_FOOTER_TRUST_GRID,
  type AppFooterConfig,
  type AppFooterTrustGrid,
} from './appFooterConfigDefaults';

export type { AppFooterConfig };
export { DEFAULT_APP_FOOTER_CONFIG };

let cached: AppFooterConfig | null = null;
let cachedAt = 0;
let inflight: Promise<AppFooterConfig> | null = null;

function pickTrustGrid(raw: any): AppFooterTrustGrid {
  const base = DEFAULT_APP_FOOTER_TRUST_GRID;
  const grid = Array.isArray(raw?.trust_grid) ? raw.trust_grid : [];
  return [0, 1, 2, 3].map((index) => ({
    value: String(grid[index]?.value || base[index].value).trim() || base[index].value,
    label: String(grid[index]?.label || base[index].label).trim() || base[index].label,
  })) as AppFooterTrustGrid;
}

function normalizeConfig(raw: any): AppFooterConfig {
  const base = DEFAULT_APP_FOOTER_CONFIG;
  const stats = Array.isArray(raw?.stats) ? raw.stats : base.stats;
  const legacyBottom =
    stats[2]?.value || stats[2]?.label
      ? `${stats[2]?.value || ''} ${String(stats[2]?.label || '').replace(/\n/g, ' ')}`.trim()
      : '';
  return {
    headline_line1: String(raw?.headline_line1 || base.headline_line1).trim() || base.headline_line1,
    headline_line2: String(raw?.headline_line2 || base.headline_line2).trim() || base.headline_line2,
    stats: [0, 1].map((i) => ({
      value: String(stats[i]?.value || base.stats[i as 0 | 1].value).trim() || base.stats[i as 0 | 1].value,
      label: String(stats[i]?.label || base.stats[i as 0 | 1].label).trim() || base.stats[i as 0 | 1].label,
    })) as AppFooterConfig['stats'],
    trust_grid: pickTrustGrid(raw),
    bottom_line:
      String(raw?.bottom_line || legacyBottom || base.bottom_line).trim() || base.bottom_line,
  };
}

export function invalidateAppFooterConfigCache() {
  cached = null;
  cachedAt = 0;
  inflight = null;
}

export async function fetchAppFooterConfig(force = false): Promise<AppFooterConfig> {
  if (!force && cached && Date.now() - cachedAt < 60_000) return cached;
  if (!force && inflight) return inflight;

  const cacheBuster = force ? `?_=${Date.now()}` : '';
  inflight = fetch(`${ENV.API_URL}/api/public/app-footer/config${cacheBuster}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  })
    .then(async (res) => {
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return DEFAULT_APP_FOOTER_CONFIG;
      return normalizeConfig(json?.config);
    })
    .catch(() => DEFAULT_APP_FOOTER_CONFIG)
    .then((value) => {
      cached = value;
      cachedAt = Date.now();
      inflight = null;
      return value;
    });

  return inflight;
}
