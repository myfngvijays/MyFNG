export type HomeSmartToolSlot = 'after_services' | 'after_loan_card' | 'main_grid' | 'before_reviews';
export type SearchSmartToolSlot = 'after_popular_searches' | 'after_other_services' | 'main_grid';
export type ServicesSmartToolSlot = 'before_why_myfng' | 'before_transparency';
export type RsaSmartToolSlot = 'after_services' | 'before_pricing' | 'before_reviews' | 'before_faqs';
export type SettingsSmartToolSlot = 'before_menu';

export type SmartToolScreen = 'home' | 'search' | 'services' | 'rsa' | 'settings';

export type SmartToolPlacements = {
  home?: Partial<Record<HomeSmartToolSlot, boolean>>;
  search?: Partial<Record<SearchSmartToolSlot, boolean>>;
  services?: Partial<Record<ServicesSmartToolSlot, boolean>>;
  rsa?: Partial<Record<RsaSmartToolSlot, boolean>>;
  settings?: Partial<Record<SettingsSmartToolSlot, boolean>>;
};

export const HOME_SMART_TOOL_PLACEMENT_OPTIONS: Array<{ key: HomeSmartToolSlot; label: string }> = [
  { key: 'after_services', label: 'After Our Services' },
  { key: 'after_loan_card', label: 'After Loan Against Car card' },
  { key: 'main_grid', label: 'Main Smart Tools grid (default block)' },
  { key: 'before_reviews', label: 'Before Reviews / Testimonials' },
];

export const SEARCH_SMART_TOOL_PLACEMENT_OPTIONS: Array<{ key: SearchSmartToolSlot; label: string }> = [
  { key: 'after_popular_searches', label: 'After Popular Searches' },
  { key: 'after_other_services', label: 'After Other Services' },
  { key: 'main_grid', label: 'Main Smart Tools section' },
];

export const SERVICES_SMART_TOOL_PLACEMENT_OPTIONS: Array<{ key: ServicesSmartToolSlot; label: string }> = [
  { key: 'before_why_myfng', label: 'Before Why MyFNG section' },
  { key: 'before_transparency', label: 'Before Complete Transparency section' },
];

export const RSA_SMART_TOOL_PLACEMENT_OPTIONS: Array<{ key: RsaSmartToolSlot; label: string }> = [
  { key: 'after_services', label: 'After Our RSA Services grid' },
  { key: 'before_pricing', label: 'Before Pricing section' },
  { key: 'before_reviews', label: 'Before Reviews / Testimonials' },
  { key: 'before_faqs', label: 'Before FAQs section' },
];

export const SETTINGS_SMART_TOOL_PLACEMENT_OPTIONS: Array<{ key: SettingsSmartToolSlot; label: string }> = [
  { key: 'before_menu', label: 'Above My Profile / menu grid (expandable card)' },
];

export function defaultSmartToolPlacements(): SmartToolPlacements {
  return {
    home: { main_grid: true },
    search: { main_grid: true },
    settings: { before_menu: true },
  };
}

export function mergeSmartToolPlacements(
  parsed: SmartToolPlacements,
  defaults: SmartToolPlacements = defaultSmartToolPlacements(),
): SmartToolPlacements {
  return {
    home: { ...defaults.home, ...parsed.home },
    search: { ...defaults.search, ...parsed.search },
    services: { ...defaults.services, ...parsed.services },
    rsa: { ...defaults.rsa, ...parsed.rsa },
    settings: { ...defaults.settings, ...parsed.settings },
  };
}

export function parseSmartToolPlacements(raw: unknown): SmartToolPlacements {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaultSmartToolPlacements();
  }
  return raw as SmartToolPlacements;
}

export function toggleSmartToolPlacement(
  placements: SmartToolPlacements,
  screen: SmartToolScreen,
  key: string,
  checked: boolean,
): SmartToolPlacements {
  return {
    ...placements,
    [screen]: {
      ...(placements[screen] || {}),
      [key]: checked,
    },
  };
}

export function isSmartToolPlacementEnabled(placements: SmartToolPlacements, path: string): boolean {
  const parts = path.split('.');
  if (parts.length !== 2) return false;
  const [screen, slot] = parts;
  const section = (placements as Record<string, unknown>)[screen];
  if (!section || typeof section !== 'object') return false;
  return Boolean((section as Record<string, unknown>)[slot]);
}

export function legacyPlacementsFromFlags(showOnHome: boolean, showOnSearch: boolean): SmartToolPlacements {
  return mergeSmartToolPlacements({
    home: { main_grid: showOnHome },
    search: { main_grid: showOnSearch },
  });
}

export function syncLegacyVisibilityFlags(placements: SmartToolPlacements): {
  show_on_home: boolean;
  show_on_search: boolean;
} {
  const home = placements.home || {};
  const search = placements.search || {};
  return {
    show_on_home: Object.values(home).some(Boolean),
    show_on_search: Object.values(search).some(Boolean),
  };
}

export function countEnabledSmartToolPlacements(placements: SmartToolPlacements): number {
  let count = 0;
  for (const slot of Object.values(placements.home || {})) if (slot) count += 1;
  for (const slot of Object.values(placements.search || {})) if (slot) count += 1;
  for (const slot of Object.values(placements.services || {})) if (slot) count += 1;
  for (const slot of Object.values(placements.rsa || {})) if (slot) count += 1;
  for (const slot of Object.values(placements.settings || {})) if (slot) count += 1;
  return count;
}

const PLACEMENT_LABELS: Record<string, Record<string, string>> = {
  home: Object.fromEntries(HOME_SMART_TOOL_PLACEMENT_OPTIONS.map((o) => [o.key, o.label])),
  search: Object.fromEntries(SEARCH_SMART_TOOL_PLACEMENT_OPTIONS.map((o) => [o.key, o.label])),
  services: Object.fromEntries(SERVICES_SMART_TOOL_PLACEMENT_OPTIONS.map((o) => [o.key, o.label])),
  rsa: Object.fromEntries(RSA_SMART_TOOL_PLACEMENT_OPTIONS.map((o) => [o.key, o.label])),
  settings: Object.fromEntries(SETTINGS_SMART_TOOL_PLACEMENT_OPTIONS.map((o) => [o.key, o.label])),
};

export function listEnabledSmartToolPlacementLabels(placements: SmartToolPlacements): string[] {
  const labels: string[] = [];
  for (const screen of ['home', 'search', 'services', 'rsa', 'settings'] as const) {
    const section = placements[screen] || {};
    for (const [key, enabled] of Object.entries(section)) {
      if (!enabled) continue;
      const label = PLACEMENT_LABELS[screen]?.[key] || key;
      labels.push(`${screen} · ${label}`);
    }
  }
  return labels;
}

export function normalizeAllowedPlanIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => String(id || '').trim()).filter(Boolean))];
}

export function toolHasMembershipRestriction(
  membershipOnly: boolean,
  allowedPlanIds: string[],
): boolean {
  return membershipOnly || allowedPlanIds.length > 0;
}
