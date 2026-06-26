import {
  buildVisibilityInsert,
  buildVisibilityPatch,
  isVisibleOnPlatform,
  migrationHintForAndroidIosError,
  normalizeContentPlatform,
  resolveContentVisibility,
  type ContentPlatform,
} from '@/lib/content-platform-visibility';

export const PUBLIC_FAQS_TABLE = 'public_faqs';

export const MIGRATION_229_HINT =
  'Run `database/229_public_faqs.sql` for unified admin-managed FAQs (General, Service, RSA).';

export type PublicFaqGroup = 'GENERAL' | 'SERVICE' | 'RSA';
export type PublicFaqPlatform = ContentPlatform;

export type PublicFaqRow = {
  id: string;
  faq_group: PublicFaqGroup;
  section_key: string;
  section_title: string;
  question: string;
  answer: string;
  display_order: number;
  active: boolean;
  visible_android: boolean;
  visible_ios: boolean;
  visible_app: boolean;
  visible_web: boolean;
  created_at?: string;
  updated_at?: string;
};

export function normalizePublicFaqGroup(raw: unknown): PublicFaqGroup {
  const value = String(raw || 'GENERAL').toUpperCase();
  if (value === 'SERVICE' || value === 'RSA') return value;
  return 'GENERAL';
}

export function normalizePublicFaqPlatform(raw: unknown): PublicFaqPlatform {
  return normalizeContentPlatform(raw);
}

export function sortPublicFaqs<T extends { display_order?: number; created_at?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const orderDiff = (Number(a.display_order) || 0) - (Number(b.display_order) || 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
}

export function mapPublicFaqRow(row: any): PublicFaqRow {
  const active = row.active !== false;
  const visibility = resolveContentVisibility(row, active);
  return {
    id: String(row.id),
    faq_group: normalizePublicFaqGroup(row.faq_group),
    section_key: String(row.section_key || 'general'),
    section_title: String(row.section_title || 'General'),
    question: String(row.question || '').trim(),
    answer: String(row.answer || '').trim(),
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

export function isFaqVisibleOnPlatform(row: PublicFaqRow, platform: PublicFaqPlatform) {
  if (!row.question.trim() || !row.answer.trim()) return false;
  return isVisibleOnPlatform(row, platform);
}

export function faqsToPayload(rows: PublicFaqRow[], platform: PublicFaqPlatform = 'app') {
  return sortPublicFaqs(rows.filter((r) => isFaqVisibleOnPlatform(r, platform))).map((r) => ({
    q: r.question,
    a: r.answer,
    section_key: r.section_key,
    section_title: r.section_title,
    faq_group: r.faq_group,
  }));
}

export function groupFaqsBySection(rows: PublicFaqRow[], platform: PublicFaqPlatform = 'app') {
  const items = faqsToPayload(rows, platform);
  const sections = new Map<string, { title: string; faq_group: PublicFaqGroup; items: Array<{ q: string; a: string }> }>();
  for (const item of items) {
    const key = `${item.faq_group}:${item.section_key}`;
    if (!sections.has(key)) {
      sections.set(key, { title: item.section_title, faq_group: item.faq_group, items: [] });
    }
    sections.get(key)!.items.push({ q: item.q, a: item.a });
  }
  return Array.from(sections.values());
}

export function buildPublicFaqInsert(body: Record<string, unknown>) {
  const visibility = buildVisibilityInsert(body);
  return {
    faq_group: normalizePublicFaqGroup(body.faq_group),
    section_key: String(body.section_key || 'general').trim() || 'general',
    section_title: String(body.section_title || 'General').trim() || 'General',
    question: String(body.question || '').trim(),
    answer: String(body.answer || '').trim(),
    display_order: Number(body.display_order) || 0,
    ...visibility,
    updated_at: new Date().toISOString(),
  };
}

export function buildPublicFaqUpdate(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    ...buildVisibilityPatch(body),
  };
  if (body.faq_group !== undefined) updates.faq_group = normalizePublicFaqGroup(body.faq_group);
  if (body.section_key !== undefined) updates.section_key = String(body.section_key || 'general').trim() || 'general';
  if (body.section_title !== undefined) updates.section_title = String(body.section_title || 'General').trim() || 'General';
  if (body.question !== undefined) updates.question = String(body.question || '').trim();
  if (body.answer !== undefined) updates.answer = String(body.answer || '').trim();
  if (body.display_order !== undefined) updates.display_order = Number(body.display_order) || 0;
  return updates;
}

export function migrationHintForPublicFaqsError(message: string): string | undefined {
  return migrationHintForAndroidIosError(message) || (/public_faqs/i.test(message) ? MIGRATION_229_HINT : undefined);
}

export const SERVICE_FAQ_SECTIONS = [
  { key: 'periodic-car-service', title: 'Periodic Car Service' },
  { key: 'ac-service', title: 'AC Service' },
  { key: 'car-engine-service', title: 'Car Engine Service' },
  { key: 'battery-service', title: 'Battery Service' },
  { key: 'brake-service', title: 'Brake Service' },
  { key: 'tyre-service', title: 'Tyre Service' },
  { key: 'denting-painting', title: 'Denting & Painting' },
  { key: 'car-detailing', title: 'Car Detailing' },
  { key: 'clutch-service', title: 'Clutch Service' },
] as const;