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
  { key: 'search_banner', label: 'Search overlay — banner strip' },
  { key: 'search_grid', label: 'Search overlay — Buy MyFNG Prime grid tile' },
];

export function defaultPlacementsForType(type: MembershipType): AppPlacements {
  if (type === 'RSA') {
    return {
      settings_page: true,
      search_banner: false,
      search_grid: false,
      rsa: {
        before_pricing: true,
      },
    };
  }
  return {
    settings_page: true,
    search_banner: true,
    search_grid: true,
    home: {
      after_services: true,
      after_loan_card: true,
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
  return raw as AppPlacements;
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
  if (placements.search_banner) count += 1;
  if (placements.search_grid) count += 1;
  for (const slot of Object.values(placements.home || {})) if (slot) count += 1;
  for (const slot of Object.values(placements.rsa || {})) if (slot) count += 1;
  for (const slot of Object.values(placements.services || {})) if (slot) count += 1;
  return count;
}
