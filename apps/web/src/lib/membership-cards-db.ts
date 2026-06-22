import { parseCardPlacements, type CardPlacements } from './membership-card-placements';
import { normalizeMembershipType } from './membership-placements';

export const MIGRATION_156_HINT =
  'Run `database/156_membership_cards_table.sql` for standalone membership promo cards.';

export type MembershipCardRow = {
  id: string;
  title: string;
  badge?: string | null;
  benefit_line_1?: string | null;
  benefit_line_2?: string | null;
  price: number;
  original_price?: number | null;
  period_label?: string | null;
  card_animated?: boolean;
  card_style?: string;
  cta_membership_type?: string | null;
  cta_plan_code?: string | null;
  placements?: Record<string, unknown>;
  display_order?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

function isMissingTableError(message: string) {
  return /membership_cards|does not exist|schema cache/i.test(String(message || ''));
}

export function buildMembershipCardPayload(body: Record<string, unknown>) {
  const cardStyle = normalizeMembershipType(body.card_style || body.membership_type || 'SERVICE');
  const ctaType = normalizeMembershipType(body.cta_membership_type || cardStyle);
  return {
    title: String(body.title || '').trim(),
    badge: body.badge != null ? String(body.badge) : 'PRIME',
    benefit_line_1: body.benefit_line_1 != null ? String(body.benefit_line_1) : '10% off on all services',
    benefit_line_2: body.benefit_line_2 != null ? String(body.benefit_line_2) : '5% cashback to wallet',
    price: Number(body.price) || 0,
    original_price: body.original_price != null ? Number(body.original_price) : null,
    period_label: body.period_label != null ? String(body.period_label) : '/ year',
    card_animated: body.card_animated !== undefined ? !!body.card_animated : true,
    card_style: cardStyle,
    cta_membership_type: ctaType,
    cta_plan_code: body.cta_plan_code ? String(body.cta_plan_code).trim().toUpperCase() : null,
    placements:
      body.placements && typeof body.placements === 'object' && !Array.isArray(body.placements)
        ? body.placements
        : {},
    display_order: Number(body.display_order) || 0,
    active: body.active !== undefined ? !!body.active : true,
    updated_at: new Date().toISOString(),
  };
}

export function buildMembershipCardUpdatePayload(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) updates.title = String(body.title).trim();
  if (body.badge !== undefined) updates.badge = body.badge == null ? null : String(body.badge);
  if (body.benefit_line_1 !== undefined) updates.benefit_line_1 = String(body.benefit_line_1 ?? '');
  if (body.benefit_line_2 !== undefined) updates.benefit_line_2 = String(body.benefit_line_2 ?? '');
  if (body.price !== undefined) updates.price = Number(body.price) || 0;
  if (body.original_price !== undefined) {
    updates.original_price = body.original_price == null ? null : Number(body.original_price);
  }
  if (body.period_label !== undefined) updates.period_label = String(body.period_label ?? '/ year');
  if (body.card_animated !== undefined) updates.card_animated = !!body.card_animated;
  if (body.card_style !== undefined) updates.card_style = normalizeMembershipType(body.card_style);
  if (body.cta_membership_type !== undefined) {
    updates.cta_membership_type = normalizeMembershipType(body.cta_membership_type);
  }
  if (body.cta_plan_code !== undefined) {
    updates.cta_plan_code = body.cta_plan_code ? String(body.cta_plan_code).trim().toUpperCase() : null;
  }
  if (body.placements !== undefined) updates.placements = body.placements;
  if (body.display_order !== undefined) updates.display_order = Number(body.display_order) || 0;
  if (body.active !== undefined) updates.active = !!body.active;

  return updates;
}

export function sortMembershipCards<T extends { display_order?: number | null; created_at?: string | null }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const orderDiff = (Number(a.display_order) || 0) - (Number(b.display_order) || 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
}

export function mapPublicMembershipCard(row: MembershipCardRow) {
  const cardStyle = normalizeMembershipType(row.card_style);
  return {
    id: row.id,
    title: row.title,
    badge: row.badge || 'PRIME',
    benefitLine1: row.benefit_line_1 || '10% off on all services',
    benefitLine2: row.benefit_line_2 || '5% cashback to wallet',
    price: Number(row.price || 0),
    originalPrice: row.original_price != null ? Number(row.original_price) : null,
    periodLabel: row.period_label || '/ year',
    cardAnimated: row.card_animated !== false,
    cardStyle,
    ctaMembershipType: normalizeMembershipType(row.cta_membership_type || cardStyle),
    ctaPlanCode: row.cta_plan_code || null,
    placements: row.placements && typeof row.placements === 'object' ? (row.placements as CardPlacements) : {},
    displayOrder: Number(row.display_order) || 0,
  };
}

export function migrationHintForCardError(message: string): string | undefined {
  if (isMissingTableError(message)) return MIGRATION_156_HINT;
  return undefined;
}
