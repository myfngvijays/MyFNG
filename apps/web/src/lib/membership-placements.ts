export type MembershipType = 'SERVICE' | 'RSA';

export type HomePlacementSlot = 'after_services' | 'after_loan_card' | 'before_reviews';
export type RsaPlacementSlot = 'after_services' | 'before_pricing' | 'before_reviews' | 'before_faqs';
export type ServicesPlacementSlot = 'before_why_myfng';

export type AppPlacements = {
  settings_page?: boolean;
  search_banner?: boolean;
  search_grid?: boolean;
  home?: Partial<Record<HomePlacementSlot, boolean>>;
  rsa?: Partial<Record<RsaPlacementSlot, boolean>>;
  services?: Partial<Record<ServicesPlacementSlot, boolean>>;
};

export const HOME_PLACEMENT_OPTIONS: Array<{ key: HomePlacementSlot; label: string }> = [
  { key: 'after_services', label: 'After Our Services' },
  { key: 'after_loan_card', label: 'After Loan Against Car card' },
  { key: 'before_reviews', label: 'Before Reviews / Testimonials' },
];

export const RSA_PLACEMENT_OPTIONS: Array<{ key: RsaPlacementSlot; label: string }> = [
  { key: 'after_services', label: 'After Our RSA Services grid' },
  { key: 'before_pricing', label: 'Before Pricing section' },
  { key: 'before_reviews', label: 'Before Reviews / Testimonials' },
  { key: 'before_faqs', label: 'Before FAQs section' },
];

export const SERVICES_PLACEMENT_OPTIONS: Array<{ key: ServicesPlacementSlot; label: string }> = [
  { key: 'before_why_myfng', label: 'Before Why MyFNG section' },
];

export const GLOBAL_PLACEMENT_OPTIONS: Array<{ key: keyof AppPlacements; label: string }> = [
  { key: 'settings_page', label: 'Settings → Membership page (full value card)' },
];

export function defaultPlacementsForType(type: MembershipType): AppPlacements {
  if (type === 'RSA') {
    return {
      settings_page: false,
      rsa: {
        before_pricing: true,
      },
    };
  }
  return {
    settings_page: true,
    home: {
      before_reviews: true,
    },
    services: {
      before_why_myfng: true,
    },
  };
}

export function parseAppPlacements(raw: unknown, membershipType: MembershipType = 'SERVICE'): AppPlacements {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaultPlacementsForType(membershipType);
  }
  const src = raw as AppPlacements;
  if (Object.keys(src).length === 0) {
    return defaultPlacementsForType(membershipType);
  }
  return src;
}

function clearScreenSlot(
  placements: AppPlacements,
  screen: 'home' | 'rsa' | 'services',
  options: Array<{ key: string }>,
): AppPlacements {
  const section: Record<string, boolean> = {};
  for (const opt of options) {
    section[opt.key] = false;
  }
  return { ...placements, [screen]: section };
}

function selectScreenSlot<T extends string>(
  placements: AppPlacements,
  screen: 'home' | 'rsa' | 'services',
  options: Array<{ key: T }>,
  slot: T,
): AppPlacements {
  const section: Partial<Record<T, boolean>> = {};
  for (const opt of options) {
    section[opt.key] = opt.key === slot;
  }
  return { ...placements, [screen]: section };
}

function getActiveScreenSlot<T extends string>(
  placements: AppPlacements,
  screen: 'home' | 'rsa' | 'services',
  options: Array<{ key: T }>,
): T | null {
  const section = placements[screen] as Partial<Record<T, boolean>> | undefined;
  for (const opt of options) {
    if (section?.[opt.key]) return opt.key;
  }
  return null;
}

function moveScreenSlot<T extends string>(
  placements: AppPlacements,
  screen: 'home' | 'rsa' | 'services',
  options: Array<{ key: T }>,
  direction: 'up' | 'down',
): AppPlacements {
  const active = getActiveScreenSlot(placements, screen, options);
  const idx = active ? options.findIndex((o) => o.key === active) : 0;
  const nextIdx = direction === 'up' ? Math.max(0, idx - 1) : Math.min(options.length - 1, idx + 1);
  return selectScreenSlot(placements, screen, options, options[nextIdx].key);
}

export function clearHomeSlot(placements: AppPlacements): AppPlacements {
  return clearScreenSlot(placements, 'home', HOME_PLACEMENT_OPTIONS);
}

export function clearServicesSlot(placements: AppPlacements): AppPlacements {
  return clearScreenSlot(placements, 'services', SERVICES_PLACEMENT_OPTIONS);
}

export function clearRsaSlot(placements: AppPlacements): AppPlacements {
  return clearScreenSlot(placements, 'rsa', RSA_PLACEMENT_OPTIONS);
}

export function selectHomeSlot(placements: AppPlacements, slot: HomePlacementSlot): AppPlacements {
  return selectScreenSlot(placements, 'home', HOME_PLACEMENT_OPTIONS, slot);
}

export function getActiveHomeSlot(placements: AppPlacements): HomePlacementSlot | null {
  return getActiveScreenSlot(placements, 'home', HOME_PLACEMENT_OPTIONS);
}

export function moveHomeSlot(placements: AppPlacements, direction: 'up' | 'down'): AppPlacements {
  return moveScreenSlot(placements, 'home', HOME_PLACEMENT_OPTIONS, direction);
}

export function selectServicesSlot(placements: AppPlacements, slot: ServicesPlacementSlot): AppPlacements {
  return selectScreenSlot(placements, 'services', SERVICES_PLACEMENT_OPTIONS, slot);
}

export function getActiveServicesSlot(placements: AppPlacements): ServicesPlacementSlot | null {
  return getActiveScreenSlot(placements, 'services', SERVICES_PLACEMENT_OPTIONS);
}

export function moveServicesSlot(placements: AppPlacements, direction: 'up' | 'down'): AppPlacements {
  return moveScreenSlot(placements, 'services', SERVICES_PLACEMENT_OPTIONS, direction);
}

export function selectRsaSlot(placements: AppPlacements, slot: RsaPlacementSlot): AppPlacements {
  return selectScreenSlot(placements, 'rsa', RSA_PLACEMENT_OPTIONS, slot);
}

export function getActiveRsaSlot(placements: AppPlacements): RsaPlacementSlot | null {
  return getActiveScreenSlot(placements, 'rsa', RSA_PLACEMENT_OPTIONS);
}

export function moveRsaSlot(placements: AppPlacements, direction: 'up' | 'down'): AppPlacements {
  return moveScreenSlot(placements, 'rsa', RSA_PLACEMENT_OPTIONS, direction);
}

export function normalizeMembershipType(raw: unknown): MembershipType {
  return String(raw || 'SERVICE').toUpperCase() === 'RSA' ? 'RSA' : 'SERVICE';
}

export function isPlacementEnabled(
  placements: AppPlacements,
  path: string,
): boolean {
  const parts = path.split('.');
  if (parts.length === 1) {
    return Boolean((placements as Record<string, unknown>)[parts[0]]);
  }
  const [screen, slot] = parts;
  const section = (placements as Record<string, unknown>)[screen];
  if (!section || typeof section !== 'object') return false;
  return Boolean((section as Record<string, unknown>)[slot]);
}

export function countEnabledPlacements(placements: AppPlacements): number {
  let count = 0;
  if (placements.settings_page) count += 1;
  for (const slot of Object.values(placements.home || {})) if (slot) count += 1;
  for (const slot of Object.values(placements.rsa || {})) if (slot) count += 1;
  for (const slot of Object.values(placements.services || {})) if (slot) count += 1;
  return count;
}
