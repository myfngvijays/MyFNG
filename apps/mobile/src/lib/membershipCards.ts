import { ENV } from '../config/environment';
import { isCardPlacementEnabled, parseCardPlacements, type CardPlacements } from './membershipCardPlacements';
import { normalizeMembershipType, type MembershipType } from './membershipPlacements';
import { supabase } from './supabase';

export type AppMembershipCard = {
  id: string;
  title: string;
  badge: string;
  benefitLine1: string;
  benefitLine2: string;
  price: number;
  originalPrice: number | null;
  periodLabel: string;
  cardAnimated: boolean;
  cardStyle: MembershipType;
  ctaMembershipType: MembershipType;
  ctaPlanCode: string | null;
  placements: CardPlacements;
  displayOrder: number;
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function mapRow(row: any): AppMembershipCard {
  const cardStyle = normalizeMembershipType(row?.cardStyle || row?.card_style);
  return {
    id: String(row.id),
    title: String(row.title || ''),
    badge: String(row.badge || 'PRIME'),
    benefitLine1: String(row.benefitLine1 || row.benefit_line_1 || '10% off on all services'),
    benefitLine2: String(row.benefitLine2 || row.benefit_line_2 || '5% cashback to wallet'),
    price: Number(row.price || 0),
    originalPrice: row.originalPrice != null ? Number(row.originalPrice) : row.original_price != null ? Number(row.original_price) : null,
    periodLabel: String(row.periodLabel || row.period_label || '/ year'),
    cardAnimated: (row.cardAnimated ?? row.card_animated) !== false,
    cardStyle,
    ctaMembershipType: normalizeMembershipType(row.ctaMembershipType || row.cta_membership_type || cardStyle),
    ctaPlanCode: row.ctaPlanCode || row.cta_plan_code ? String(row.ctaPlanCode || row.cta_plan_code) : null,
    placements: parseCardPlacements(row.placements),
    displayOrder: Number(row.displayOrder ?? row.display_order) || 0,
  };
}

function sortCards(cards: AppMembershipCard[]) {
  return [...cards].sort((a, b) => a.displayOrder - b.displayOrder);
}

async function fetchFromApi(apiUrl: string): Promise<AppMembershipCard[]> {
  const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/public/membership-cards`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const rows: any[] = Array.isArray(json?.cards) ? json.cards : [];
  return sortCards(rows.map(mapRow));
}

async function fetchFromSupabase(): Promise<AppMembershipCard[]> {
  const { data, error } = await supabase
    .from('membership_cards')
    .select('*')
    .eq('active', true)
    .order('display_order', { ascending: true });

  if (error || !data?.length) return [];
  return sortCards(data.map(mapRow));
}

export async function fetchAppMembershipCards(apiUrl: string): Promise<AppMembershipCard[]> {
  try {
    const fromApi = await fetchFromApi(apiUrl);
    if (fromApi.length) return fromApi;
  } catch {
    // fall through
  }
  try {
    return await fetchFromSupabase();
  } catch {
    return [];
  }
}

export function getCardsForSlot(cards: AppMembershipCard[], screen: string, slot: string) {
  return cards
    .filter((card) => isCardPlacementEnabled(card.placements, `${screen}.${slot}`))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function cardToBannerPlan(card: AppMembershipCard) {
  return {
    name: card.title,
    badge: card.badge,
    price: inr(card.price),
    originalPrice: card.originalPrice ? inr(card.originalPrice) : undefined,
    period: card.periodLabel.replace('/', '').trim() || 'year',
    benefitLine1: card.benefitLine1,
    benefitLine2: card.benefitLine2,
    membershipType: card.cardStyle,
  };
}

export { inr as formatMembershipCardPrice };
