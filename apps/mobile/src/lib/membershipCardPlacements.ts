import type { MembershipType } from './membershipPlacements';

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

export function isCardPlacementEnabled(placements: CardPlacements, path: string): boolean {
  const parts = path.split('.');
  if (parts.length !== 2) return false;
  const [screen, slot] = parts;
  const section = (placements as Record<string, unknown>)[screen];
  if (!section || typeof section !== 'object') return false;
  return Boolean((section as Record<string, unknown>)[slot]);
}
