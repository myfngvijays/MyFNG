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

export function defaultPlacementsForType(type: MembershipType): AppPlacements {
  if (type === 'RSA') {
    return {
      settings_page: true,
      search_banner: false,
      search_grid: false,
      rsa: { before_pricing: true },
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
    services: { before_why_myfng: true },
  };
}

export function normalizeMembershipType(raw: unknown): MembershipType {
  return String(raw || 'SERVICE').toUpperCase() === 'RSA' ? 'RSA' : 'SERVICE';
}

export function parseAppPlacements(raw: unknown, membershipType: MembershipType = 'SERVICE'): AppPlacements {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaultPlacementsForType(membershipType);
  }
  return raw as AppPlacements;
}

export function isPlacementEnabled(placements: AppPlacements, path: string): boolean {
  const parts = path.split('.');
  if (parts.length === 1) {
    return Boolean((placements as Record<string, unknown>)[parts[0]]);
  }
  const [screen, slot] = parts;
  const section = (placements as Record<string, unknown>)[screen];
  if (!section || typeof section !== 'object') return false;
  return Boolean((section as Record<string, unknown>)[slot]);
}

export function hasAnySearchGridPlan(plans: Array<{ appPlacements: AppPlacements }>): boolean {
  return plans.some((p) => Boolean(p.appPlacements.search_grid));
}

export function hasAnySearchBannerPlan(plans: Array<{ appPlacements: AppPlacements }>): boolean {
  return plans.some((p) => Boolean(p.appPlacements.search_banner));
}

export function getSettingsPlans<T extends { membershipType: MembershipType; appPlacements: AppPlacements }>(
  plans: T[],
  membershipType?: MembershipType,
): T[] {
  return plans.filter(
    (p) =>
      Boolean(p.appPlacements.settings_page) &&
      (membershipType ? p.membershipType === membershipType : true),
  );
}
