import type { WhatsAppListSection } from '@/lib/services/whatsappService';

export type PricingPlanItem = {
  service_name: string;
  min_price: number;
  max_price: number;
  description?: string | null;
  service_type_id?: string | null;
  checklist_items?: any[];
  points?: number | null;
};

export type OilType = 'semi' | 'full';

export function getOilTypeForPlan(plan: PricingPlanItem): OilType | 'unknown' {
  const text = `${String(plan?.service_name || '')} ${String(plan?.description || '')}`.toLowerCase();

  const hasSemi =
    text.includes('semi synthetic') ||
    text.includes('semi-synthetic') ||
    text.includes('(semi)') ||
    /\bsemi\b/.test(text);

  const hasFull =
    text.includes('fully synthetic') ||
    text.includes('full synthetic') ||
    text.includes('synthetic full') ||
    text.includes('(fully)') ||
    text.includes('(full)') ||
    /\bfully\b/.test(text) ||
    /\bfull\b/.test(text);

  if (hasSemi && hasFull) return 'unknown';
  if (hasFull) return 'full';
  if (hasSemi) return 'semi';
  return 'unknown';
}

function getPeriodicRank(name: string): number {
  const n = String(name || '').toLowerCase();
  if (n.includes('basic')) return 0;
  if (n.includes('general')) return 1;
  if (n.includes('premium')) return 2;
  if (n.includes('platinum')) return 3;
  return 99;
}

export function sortPeriodicPlans(plans: PricingPlanItem[]): PricingPlanItem[] {
  return [...plans].sort((a, b) => {
    const ra = getPeriodicRank(a.service_name);
    const rb = getPeriodicRank(b.service_name);
    if (ra !== rb) return ra - rb;
    return Number(a.min_price || 0) - Number(b.min_price || 0);
  });
}

export function groupPeriodicPlans(plans: PricingPlanItem[]) {
  const semi = sortPeriodicPlans(plans.filter((p) => getOilTypeForPlan(p) === 'semi'));
  const full = sortPeriodicPlans(plans.filter((p) => getOilTypeForPlan(p) === 'full'));
  const unknown = sortPeriodicPlans(plans.filter((p) => getOilTypeForPlan(p) === 'unknown'));
  return { semi, full, unknown };
}

export function isPeriodicPricing(plans: PricingPlanItem[]): boolean {
  if (!plans.length) return false;
  const grouped = groupPeriodicPlans(plans);
  return grouped.semi.length > 0 || grouped.full.length > 0;
}

export function getPlanBadge(name: string): string | null {
  const n = String(name || '').toLowerCase();
  if (n.includes('general')) return 'Most Popular';
  if (n.includes('premium')) return 'Best Value';
  if (n.includes('platinum')) return 'Top Tier';
  return null;
}

export function getPlanTierLabel(name: string): string {
  const n = String(name || '').toLowerCase();
  if (n.includes('platinum')) return 'Platinum';
  if (n.includes('premium')) return 'Premium';
  if (n.includes('general')) return 'General';
  if (n.includes('basic')) return 'Basic';
  return String(name || 'Plan')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*-\s*semi synthetic|\s*-\s*fully synthetic/gi, '')
    .trim();
}

export function getPlanPoints(plan: PricingPlanItem): string | null {
  if (typeof plan.points === 'number' && plan.points > 0) {
    return `${plan.points} pts`;
  }
  const checklistCount = Array.isArray(plan.checklist_items) ? plan.checklist_items.length : 0;
  if (checklistCount > 0) return `${checklistCount} pts`;
  const text = `${plan.service_name} ${plan.description || ''}`;
  const pointsMatch = text.match(/(\d+)\s*points?/i);
  if (pointsMatch) return `${pointsMatch[1]} pts`;
  const checkpointMatch = text.match(/(\d+)\s*checkpoint/i);
  if (checkpointMatch) return `${checkpointMatch[1]} pts`;
  return null;
}

function inr(value: number) {
  return `₹${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;
}

function formatPlanLines(plans: PricingPlanItem[]): string[] {
  return plans.map((plan, index) => {
    const tier = getPlanTierLabel(plan.service_name);
    const points = getPlanPoints(plan);
    const badge = getPlanBadge(plan.service_name);
    const parts = [`${index + 1}. ${tier}`];
    if (points) parts.push(points);
    parts.push(inr(plan.min_price));
    let line = parts.join(' · ');
    if (badge === 'Most Popular') line += ' ⭐';
    return line;
  });
}

export function formatPeriodicPricingForWhatsApp(
  plans: PricingPlanItem[],
  opts?: {
    carModel?: string | null;
    category?: string;
    includeHeader?: boolean;
    includeFooter?: boolean;
  },
): string {
  const grouped = groupPeriodicPlans(plans);
  const car = opts?.carModel?.trim();
  const category = opts?.category?.trim() || 'Car Periodic Service';
  const includeHeader = opts?.includeHeader !== false;
  const includeFooter = opts?.includeFooter !== false;

  const lines: string[] = [];
  if (includeHeader) {
    lines.push(car ? `*${category} — ${car}*` : `*${category}*`);
    lines.push('');
  }

  if (grouped.semi.length > 0) {
    lines.push('*Semi Synthetic*');
    lines.push(...formatPlanLines(grouped.semi));
    lines.push('');
  }

  if (grouped.full.length > 0) {
    lines.push('*Fully Synthetic*');
    lines.push(...formatPlanLines(grouped.full));
    lines.push('');
  }

  if (grouped.unknown.length > 0) {
    lines.push('*Other plans*');
    lines.push(...formatPlanLines(grouped.unknown));
    lines.push('');
  }

  if (includeFooter) {
    lines.push('Reply with plan number to proceed, or type *book* 😊');
  }
  return lines.join('\n').trim();
}

function normalizeChecklistKey(label: string): string {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type ChecklistRow = { name: string; category: string; key: string };

function planChecklistRows(plan: PricingPlanItem): ChecklistRow[] {
  const items = Array.isArray(plan.checklist_items) ? plan.checklist_items : [];
  const rows: ChecklistRow[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const name = checklistItemLabel(item);
    if (!name) continue;
    const key = normalizeChecklistKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push({
      name,
      category: String(item?.category || 'General').trim() || 'General',
      key,
    });
  }
  return rows;
}

/**
 * Format checklist for a plan.
 * When excludeKeys is set (higher tier after Basic), only ADDITIONAL points are shown.
 * startNumber continues count (e.g. Basic 1–15, General additional 16–30).
 */
function formatPlanPointsChecklistBlock(
  plan: PricingPlanItem,
  opts?: { excludeKeys?: Set<string>; isAdditional?: boolean; startNumber?: number },
): string[] {
  const allRows = planChecklistRows(plan);
  if (!allRows.length) return [];

  const exclude = opts?.excludeKeys;
  const rows = exclude?.size
    ? allRows.filter((r) => !exclude.has(r.key))
    : allRows;
  if (!rows.length) {
    const tier = getPlanTierLabel(plan.service_name);
    return [
      `*${tier}:* Same points as lower plan (no extra checklist items).`,
      '',
    ];
  }

  const tier = getPlanTierLabel(plan.service_name);
  const totalPts =
    typeof plan.points === 'number' && plan.points > 0 ? plan.points : allRows.length;
  const extraCount = rows.length;
  const startNumber = Math.max(1, Number(opts?.startNumber || 1));
  const endNumber = startNumber + extraCount - 1;
  const lines: string[] = [];

  if (opts?.isAdditional) {
    lines.push(
      `*Additional in ${tier} (points ${startNumber}–${endNumber} — total ${totalPts}):*`,
    );
  } else {
    lines.push(`*What's included (${totalPts} points) — ${tier}:*`);
  }
  lines.push('');

  const hasCategories = rows.some((r) => r.category && r.category !== 'General');
  let n = startNumber;
  if (hasCategories) {
    const grouped: Record<string, string[]> = {};
    rows.forEach((r) => {
      if (!grouped[r.category]) grouped[r.category] = [];
      grouped[r.category].push(r.name);
    });
    Object.entries(grouped).forEach(([cat, catItems]) => {
      lines.push(`*${cat}*`);
      catItems.forEach((label) => {
        lines.push(`${n}. ${label}`);
        n += 1;
      });
      lines.push('');
    });
  } else {
    rows.forEach((r) => {
      lines.push(`${n}. ${r.name}`);
      n += 1;
    });
    lines.push('');
  }
  return lines;
}

function planSortKey(plan: PricingPlanItem): number {
  const pts = Number(plan.points || 0);
  if (pts > 0) return pts;
  const tier = getPlanTierLabel(plan.service_name).toLowerCase();
  if (tier === 'basic') return 15;
  if (tier === 'general') return 30;
  if (tier === 'premium') return 50;
  if (tier === 'platinum') return 60;
  return 999;
}

/** Single telecaller pricing message: name + car + pin + services + plan list (+ points checklist when selected) */
export function formatTelecallerPricingWhatsApp(input: {
  customerName?: string | null;
  carModel: string;
  pincode: string;
  categories: string[];
  /** category → plans */
  blocks: Array<{ category: string; plans: PricingPlanItem[] }>;
  /** When true (specific plan selected), append point list; higher tiers show only extras */
  includePointChecklists?: boolean;
}): string {
  const name = String(input.customerName || 'Customer').trim() || 'Customer';
  const car = String(input.carModel || '').trim();
  const pin = String(input.pincode || '').replace(/\D/g, '').slice(0, 6);
  const services = (input.categories || []).filter(Boolean).join(', ') || 'Service';
  const includeChecklists = Boolean(input.includePointChecklists);

  const lines: string[] = [
    `Hi ${name},`,
    '',
    `Sharing MyFNG pricing for *${car}* (PIN ${pin}).`,
    `Services: ${services}`,
    '',
  ];

  for (const block of input.blocks || []) {
    if (!block.plans?.length) continue;
    if (isPeriodicPricing(block.plans)) {
      lines.push(
        formatPeriodicPricingForWhatsApp(block.plans, {
          category: block.category,
          includeHeader: false,
          includeFooter: false,
        }),
      );
      lines.push('');
    } else {
      lines.push(`*${block.category}*`);
      block.plans.slice(0, 16).forEach((p, i) => {
        const price = inr(p.min_price);
        const planName = String(p.service_name || 'Service')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 48);
        const pts = getPlanPoints(p);
        lines.push([`${i + 1}. ${planName}`, pts, price].filter(Boolean).join(' · '));
      });
      lines.push('');
    }

    // Specific plan(s): lowest tier full list; higher tiers = only ADDITIONAL points (16–30, …)
    // Deduplicate by tier — Semi + Fully share the same points checklist
    if (includeChecklists) {
      const seenTiers = new Set<string>();
      const ordered = [...block.plans]
        .sort((a, b) => planSortKey(a) - planSortKey(b))
        .filter((plan) => {
          const tier = getPlanTierLabel(plan.service_name);
          if (seenTiers.has(tier)) return false;
          seenTiers.add(tier);
          return true;
        });
      const coveredKeys = new Set<string>();
      let nextNumber = 1;
      ordered.forEach((plan, idx) => {
        const isAdditional = idx > 0 && coveredKeys.size > 0;
        const checklistLines = formatPlanPointsChecklistBlock(plan, {
          excludeKeys: isAdditional ? coveredKeys : undefined,
          isAdditional,
          startNumber: nextNumber,
        });
        if (checklistLines.length) {
          lines.push(...checklistLines);
        }
        // Advance numbering by how many items we actually printed for this tier
        const printed = isAdditional
          ? planChecklistRows(plan).filter((r) => !coveredKeys.has(r.key)).length
          : planChecklistRows(plan).length;
        nextNumber += printed > 0 ? printed : 0;
        // Mark all this plan's points as covered for next higher tier
        planChecklistRows(plan).forEach((r) => coveredKeys.add(r.key));
      });
    }
  }

  lines.push('Reply with plan number to proceed, or type *book* 😊');
  return lines.join('\n').trim();
}

function checklistItemLabel(item: any): string {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'number') return String(item);
  const direct = String(
    item?.name ||
      item?.title ||
      item?.item ||
      item?.label ||
      item?.point ||
      item?.checkpoint ||
      item?.description ||
      item?.text ||
      '',
  ).trim();
  if (direct) return direct;
  // Last resort: first non-empty string field
  for (const v of Object.values(item)) {
    if (typeof v === 'string' && v.trim() && v.trim().length < 120) return v.trim();
  }
  return '';
}

/** Format checklist / points detail after customer taps a plan in View plans */
export function formatSelectedPlanPointsWhatsApp(plan: PricingPlanItem): string {
  const tier = getPlanTierLabel(plan.service_name);
  const oil = getOilTypeForPlan(plan);
  const oilLabel =
    oil === 'semi' ? 'Semi Synthetic' : oil === 'full' ? 'Fully Synthetic' : null;
  const items = Array.isArray(plan.checklist_items) ? plan.checklist_items : [];
  const labels = items.map(checklistItemLabel).filter(Boolean);
  const pointCount =
    typeof plan.points === 'number' && plan.points > 0
      ? plan.points
      : labels.length > 0
        ? labels.length
        : null;
  const ptsLabel = pointCount ? `${pointCount} points` : getPlanPoints(plan);
  const price = Number(plan.min_price || 0) > 0 ? inr(plan.min_price) : null;

  const title = oilLabel
    ? `*${tier}* · ${oilLabel}`
    : `*${String(plan.service_name || tier || 'Service').trim()}*`;
  const lines: string[] = [title];
  if (ptsLabel || price) {
    lines.push([ptsLabel, price].filter(Boolean).join(' · '));
  }
  lines.push('');

  if (labels.length) {
    lines.push(`What's included (${pointCount || labels.length} points):`);
    lines.push('');

    const hasCategories = items.some(
      (item, idx) => labels[idx] && String(item?.category || '').trim(),
    );
    if (hasCategories) {
      const grouped: Record<string, string[]> = {};
      items.forEach((item: any) => {
        const name = checklistItemLabel(item);
        if (!name) return;
        const cat = String(item?.category || 'General').trim() || 'General';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(name);
      });
      let n = 1;
      Object.entries(grouped).forEach(([cat, catItems]) => {
        lines.push(`${cat}:`);
        catItems.forEach((name) => {
          lines.push(`${n}. ${name}`);
          n += 1;
        });
        lines.push('');
      });
    } else {
      labels.forEach((name, idx) => {
        lines.push(`${idx + 1}. ${name}`);
      });
      lines.push('');
    }
  } else if (plan.description) {
    lines.push(String(plan.description).trim());
    lines.push('');
  } else {
    lines.push('Detailed checklist will be shared by our team when you book.');
    lines.push('');
  }

  lines.push('Reply book to continue with this plan.');
  return lines.join('\n').trim();
}

export const TELECALLER_PRICING_LIST_PREFIX = 'tcp_';

export function buildTelecallerPricingListRowId(plan: PricingPlanItem, fallbackKey: string): string {
  const stid = String(plan.service_type_id || '').trim();
  if (stid) return `${TELECALLER_PRICING_LIST_PREFIX}${stid}`.slice(0, 200);
  return `${TELECALLER_PRICING_LIST_PREFIX}${fallbackKey}`.slice(0, 200);
}

export function filterPeriodicPlansByOilReply(
  plans: PricingPlanItem[],
  message: string,
): PricingPlanItem[] | null {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return null;
  if (text.includes('semi')) return plans.filter((p) => getOilTypeForPlan(p) === 'semi');
  if (text.includes('fully') || text === 'full' || text.includes('full synthetic')) {
    return plans.filter((p) => getOilTypeForPlan(p) === 'full');
  }
  return null;
}

export function buildPeriodicPlanListSections(plans: PricingPlanItem[]): WhatsAppListSection[] {
  const grouped = groupPeriodicPlans(plans);
  const sections: WhatsAppListSection[] = [];

  const pushSection = (title: string, items: PricingPlanItem[], prefix: string) => {
    if (!items.length) return;
    sections.push({
      title: title.slice(0, 24),
      rows: items.map((plan, index) => {
        const tier = getPlanTierLabel(plan.service_name);
        const points =
          typeof plan.points === 'number' && plan.points > 0
            ? `${plan.points} pts`
            : getPlanPoints(plan);
        const price = inr(plan.min_price);
        return {
          id: buildTelecallerPricingListRowId(plan, `${prefix}_${index + 1}`),
          title: tier.slice(0, 24),
          description: [points, price].filter(Boolean).join(' · ').slice(0, 72),
        };
      }),
    });
  };

  pushSection('Semi Synthetic', grouped.semi, 'semi');
  pushSection('Fully Synthetic', grouped.full, 'full');
  pushSection('Other plans', grouped.unknown, 'plan');

  const totalRows = sections.reduce((sum, section) => sum + section.rows.length, 0);
  return totalRows > 10 ? [] : sections;
}

export function findPlanByListReplyId(
  plans: PricingPlanItem[],
  replyId: string,
): PricingPlanItem | null {
  const id = String(replyId || '').trim();
  if (!id || !plans?.length) return null;

  if (id.startsWith(TELECALLER_PRICING_LIST_PREFIX)) {
    const key = id.slice(TELECALLER_PRICING_LIST_PREFIX.length);
    const byStid = plans.find((p) => String(p.service_type_id || '').trim() === key);
    if (byStid) return byStid;
  }

  // Legacy / fallback ids: semi_1 / full_2 / svc_3
  const m = id.match(/^(?:tcp_)?(semi|full|plan|svc)_(\d+)$/i);
  if (m) {
    const kind = m[1].toLowerCase();
    const idx = Number(m[2]) - 1;
    if (kind === 'svc' || kind === 'plan') {
      return plans[idx] || null;
    }
    const grouped = groupPeriodicPlans(plans);
    const bucket = kind === 'semi' ? grouped.semi : grouped.full;
    return bucket[idx] || null;
  }

  return null;
}

export function canSendPeriodicPlanList(plans: PricingPlanItem[]): boolean {
  return buildPeriodicPlanListSections(plans).length > 0;
}

/** Generic View plans list for any services (AC, Battery, etc.) — max 10 rows. */
export function buildGenericPlanListSections(
  plans: PricingPlanItem[],
  sectionTitle = 'Services',
): WhatsAppListSection[] {
  const rows = (plans || []).slice(0, 10).map((plan, index) => {
    const title = getPlanTierLabel(plan.service_name) || String(plan.service_name || 'Service');
    const points = getPlanPoints(plan);
    const price = inr(plan.min_price);
    return {
      id: buildTelecallerPricingListRowId(plan, `svc_${index + 1}`),
      title: title.slice(0, 24),
      description: [points, price].filter(Boolean).join(' · ').slice(0, 72),
    };
  });
  if (!rows.length) return [];
  return [{ title: sectionTitle.slice(0, 24), rows }];
}

export function buildPricingViewPlansSections(input: {
  blocks: Array<{ category: string; plans: PricingPlanItem[] }>;
}): WhatsAppListSection[] {
  const blocks = input.blocks || [];
  const periodicPlans = blocks
    .filter((b) => /periodic/i.test(b.category) || isPeriodicPricing(b.plans))
    .flatMap((b) => b.plans);
  if (periodicPlans.length && canSendPeriodicPlanList(periodicPlans)) {
    return buildPeriodicPlanListSections(periodicPlans);
  }

  // Other services — one section per category, trim to WhatsApp 10-row limit
  const sections: WhatsAppListSection[] = [];
  let remaining = 10;
  for (const block of blocks) {
    if (remaining <= 0) break;
    const plans = (block.plans || []).slice(0, remaining);
    if (!plans.length) continue;
    const built = buildGenericPlanListSections(
      plans,
      String(block.category || 'Services')
        .replace(/^Car\s+/i, '')
        .slice(0, 24),
    );
    for (const section of built) {
      const rows = section.rows.slice(0, remaining);
      if (!rows.length) continue;
      sections.push({ ...section, rows });
      remaining -= rows.length;
    }
  }
  return sections;
}

export function canSendPricingViewPlansList(
  blocks: Array<{ category: string; plans: PricingPlanItem[] }>,
): boolean {
  return buildPricingViewPlansSections({ blocks }).length > 0;
}

export function extractCarModelFromMessage(message: string): string | null {
  const m = String(message || '').match(/for\s+([a-z0-9][a-z0-9\s-]{0,24}?)\s+in\s+\d{6}/i);
  if (m?.[1]) return m[1].trim();
  const m2 = String(message || '').match(/for\s+(?:my\s+)?([a-z0-9][a-z0-9\s-]{0,24}?)(?:\s|$|\?)/i);
  return m2?.[1]?.trim() || null;
}
