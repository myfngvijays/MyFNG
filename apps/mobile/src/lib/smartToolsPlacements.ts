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

export function normalizeAllowedPlanIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => String(id || '').trim()).filter(Boolean))];
}

/** Normalize to unique 10-digit phones (last 10 digits). Accepts array or free text. */
export function normalizeAllowedPhones(raw: unknown): string[] {
  const chunks: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) chunks.push(String(item || ''));
  } else if (typeof raw === 'string') {
    chunks.push(...raw.split(/[\s,;]+/));
  } else if (raw == null) {
    return [];
  } else {
    chunks.push(String(raw));
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const digits = chunk.replace(/\D/g, '');
    if (digits.length < 10) continue;
    const phone = digits.slice(-10);
    if (seen.has(phone)) continue;
    seen.add(phone);
    out.push(phone);
  }
  return out;
}
