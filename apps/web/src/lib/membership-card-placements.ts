import type { MembershipType } from './membership-placements';

export type HomeCardSlot = 'after_services' | 'after_loan_card' | 'after_smart_tools' | 'before_reviews';
export type SearchCardSlot = 'after_popular_searches' | 'after_other_services' | 'after_smart_tools';
export type ServicesCardSlot = 'before_why_myfng' | 'before_transparency';
export type RsaCardSlot = 'after_services' | 'before_pricing' | 'before_reviews' | 'before_faqs';

export type CardPlacements = {
  home?: Partial<Record<HomeCardSlot, boolean>>;
  search?: Partial<Record<SearchCardSlot, boolean>>;
  services?: Partial<Record<ServicesCardSlot, boolean>>;
  rsa?: Partial<Record<RsaCardSlot, boolean>>;
};

export const HOME_CARD_PLACEMENT_OPTIONS: Array<{ key: HomeCardSlot; label: string }> = [
  { key: 'after_services', label: 'After Our Services' },
  { key: 'after_loan_card', label: 'After Loan Against Car card' },
  { key: 'after_smart_tools', label: 'After Smart Tools section' },
  { key: 'before_reviews', label: 'Before Reviews / Testimonials' },
];

export const SEARCH_CARD_PLACEMENT_OPTIONS: Array<{ key: SearchCardSlot; label: string }> = [
  { key: 'after_popular_searches', label: 'After Popular Searches' },
  { key: 'after_other_services', label: 'After Other Services' },
  { key: 'after_smart_tools', label: 'After Smart Tools' },
];

export const SERVICES_CARD_PLACEMENT_OPTIONS: Array<{ key: ServicesCardSlot; label: string }> = [
  { key: 'before_why_myfng', label: 'Before Why MyFNG section' },
  { key: 'before_transparency', label: 'Before Complete Transparency section' },
];

export const RSA_CARD_PLACEMENT_OPTIONS: Array<{ key: RsaCardSlot; label: string }> = [
  { key: 'after_services', label: 'After Our RSA Services grid' },
  { key: 'before_pricing', label: 'Before Pricing section' },
  { key: 'before_reviews', label: 'Before Reviews / Testimonials' },
  { key: 'before_faqs', label: 'Before FAQs section' },
];

export function defaultCardPlacementsForType(type: MembershipType): CardPlacements {
  if (type === 'RSA') {
    return { rsa: { before_pricing: true } };
  }
  return {
    home: { before_reviews: true },
    search: { after_smart_tools: true },
  };
}

export function parseCardPlacements(raw: unknown, _membershipType: MembershipType = 'SERVICE'): CardPlacements {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return raw as CardPlacements;
}

export function toggleCardPlacement(
  placements: CardPlacements,
  screen: 'home' | 'search' | 'services' | 'rsa',
  key: string,
  checked: boolean,
): CardPlacements {
  return {
    ...placements,
    [screen]: {
      ...(placements[screen] || {}),
      [key]: checked,
    },
  };
}

export function isCardPlacementEnabled(placements: CardPlacements, path: string): boolean {
  const parts = path.split('.');
  if (parts.length !== 2) return false;
  const [screen, slot] = parts;
  const section = (placements as Record<string, unknown>)[screen];
  if (!section || typeof section !== 'object') return false;
  return Boolean((section as Record<string, unknown>)[slot]);
}

export function countEnabledCardPlacements(placements: CardPlacements): number {
  let count = 0;
  for (const slot of Object.values(placements.home || {})) if (slot) count += 1;
  for (const slot of Object.values(placements.search || {})) if (slot) count += 1;
  for (const slot of Object.values(placements.services || {})) if (slot) count += 1;
  for (const slot of Object.values(placements.rsa || {})) if (slot) count += 1;
  return count;
}

const PLACEMENT_LABELS: Record<string, Record<string, string>> = {
  home: Object.fromEntries(HOME_CARD_PLACEMENT_OPTIONS.map((o) => [o.key, o.label])),
  search: Object.fromEntries(SEARCH_CARD_PLACEMENT_OPTIONS.map((o) => [o.key, o.label])),
  services: Object.fromEntries(SERVICES_CARD_PLACEMENT_OPTIONS.map((o) => [o.key, o.label])),
  rsa: Object.fromEntries(RSA_CARD_PLACEMENT_OPTIONS.map((o) => [o.key, o.label])),
};

export function listEnabledPlacementLabels(placements: CardPlacements): string[] {
  const labels: string[] = [];
  for (const screen of ['home', 'search', 'services', 'rsa'] as const) {
    const section = placements[screen] || {};
    for (const [key, enabled] of Object.entries(section)) {
      if (!enabled) continue;
      const label = PLACEMENT_LABELS[screen]?.[key] || key;
      labels.push(`${screen} · ${label}`);
    }
  }
  return labels;
}
