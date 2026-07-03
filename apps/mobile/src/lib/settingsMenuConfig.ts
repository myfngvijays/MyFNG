import { ENV } from '../config/environment';

export type SettingsMenuItem = {
  menu_id: string;
  label: string;
  icon: string;
  section: string;
  enabled: boolean;
  display_order: number;
  requires_login: boolean;
};

export type SettingsMenuConfig = {
  main: SettingsMenuItem[];
  legal: SettingsMenuItem[];
};

let cache: { data: SettingsMenuConfig; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function fetchSettingsMenuConfig(): Promise<SettingsMenuConfig | null> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.data;

  try {
    const url = `${ENV.API_URL}/api/public/app-settings-menu`;
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json: SettingsMenuConfig = await res.json();
    if (json?.main && json?.legal) {
      cache = { data: json, ts: Date.now() };
      return json;
    }
    return null;
  } catch {
    return null;
  }
}

export function getEnabledMenuIds(config: SettingsMenuConfig): Set<string> {
  const ids = new Set<string>();
  for (const item of [...config.main, ...config.legal]) {
    if (item.enabled) ids.add(item.menu_id);
  }
  return ids;
}
