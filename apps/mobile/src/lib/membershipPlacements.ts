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
      settings_page: false,
      rsa: { before_pricing: true },
    };
  }
  return {
    settings_page: true,
    home: { before_reviews: true },
    services: { before_why_myfng: true },
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

export function normalizeMembershipType(raw: unknown): MembershipType {
  return String(raw || 'SERVICE').toUpperCase() === 'RSA' ? 'RSA' : 'SERVICE';
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

export function hasAnySearchGridPlan(_plans: Array<{ appPlacements: AppPlacements }>): boolean {
  return false;
}

export function hasAnySearchBannerPlan(_plans: Array<{ appPlacements: AppPlacements }>): boolean {
  return false;
}

export function getSettingsPlans<T extends { membershipType: MembershipType; appPlacements: AppPlacements }>(
  plans: T[],
  membershipType?: MembershipType,
): T[] {
  return plans.filter(
    (p) =>
      isPlacementEnabled(p.appPlacements, 'settings_page') &&
      (membershipType ? p.membershipType === membershipType : true),
  );
}
