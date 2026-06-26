import { normalizeMembershipType, type MembershipType } from '@/lib/membership-placements';
import {
  buildVisibilityInsert,
  buildVisibilityPatch,
  isVisibleOnPlatform,
  migrationHintForAndroidIosError,
  normalizeContentPlatform,
  resolveContentVisibility,
  type ContentPlatform,
} from '@/lib/content-platform-visibility';

export const MEMBERSHIP_TERMS_TABLE = 'membership_terms';

export const MIGRATION_227_HINT =
  'Run `database/227_membership_terms.sql` for admin-managed RSA & Prime membership Terms & Conditions.';

export const MIGRATION_228_HINT =
  'Run `database/228_membership_terms_platform_visibility.sql` for separate app vs website visibility toggles.';

export type MembershipTermPlatform = ContentPlatform;

export type MembershipTermRow = {
  id: string;
  membership_type: MembershipType;
  body: string;
  display_order: number;
  active: boolean;
  visible_android: boolean;
  visible_ios: boolean;
  visible_app: boolean;
  visible_web: boolean;
  created_at?: string;
  updated_at?: string;
};

export function normalizeMembershipTermType(raw: unknown): MembershipType {
  return normalizeMembershipType(raw);
}

export function normalizeMembershipTermPlatform(raw: unknown): MembershipTermPlatform {
  return normalizeContentPlatform(raw);
}

export function sortMembershipTerms<T extends { display_order?: number; created_at?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const orderDiff = (Number(a.display_order) || 0) - (Number(b.display_order) || 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
}

export function mapMembershipTermRow(row: any): MembershipTermRow {
  const active = row.active !== false;
  const visibility = resolveContentVisibility(row, active);
  return {
    id: String(row.id),
    membership_type: normalizeMembershipTermType(row.membership_type),
    body: String(row.body || '').trim(),
    display_order: Number(row.display_order) || 0,
    active: visibility.active,
    visible_android: visibility.visible_android,
    visible_ios: visibility.visible_ios,
    visible_app: visibility.visible_app,
    visible_web: visibility.visible_web,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function isTermVisibleOnPlatform(row: MembershipTermRow, platform: MembershipTermPlatform) {
  if (!row.body.trim()) return false;
  return isVisibleOnPlatform(row, platform);
}

export function termsToPublicPayload(rows: MembershipTermRow[], platform: MembershipTermPlatform = 'app') {
  return sortMembershipTerms(rows.filter((r) => isTermVisibleOnPlatform(r, platform))).map((r) => r.body);
}

export function buildMembershipTermInsert(body: Record<string, unknown>) {
  const visibility = buildVisibilityInsert(body);
  return {
    membership_type: normalizeMembershipTermType(body.membership_type),
    body: String(body.body || '').trim(),
    display_order: Number(body.display_order) || 0,
    ...visibility,
    updated_at: new Date().toISOString(),
  };
}

export function buildMembershipTermUpdate(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    ...buildVisibilityPatch(body),
  };
  if (body.membership_type !== undefined) {
    updates.membership_type = normalizeMembershipTermType(body.membership_type);
  }
  if (body.body !== undefined) updates.body = String(body.body || '').trim();
  if (body.display_order !== undefined) updates.display_order = Number(body.display_order) || 0;
  return updates;
}

export function migrationHintForMembershipTermsError(message: string): string | undefined {
  return migrationHintForAndroidIosError(message) || (/visible_app|visible_web/i.test(message) ? MIGRATION_228_HINT : undefined) || (/membership_terms/i.test(message) ? MIGRATION_227_HINT : undefined);
}
