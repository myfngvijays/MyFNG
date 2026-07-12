export type PricingPlanItem = {
  service_name: string;
  min_price: number;
  max_price: number;
  description?: string | null;
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
  opts?: { carModel?: string | null; category?: string },
): string {
  const grouped = groupPeriodicPlans(plans);
  const car = opts?.carModel?.trim();
  const category = opts?.category?.trim() || 'Car Periodic Service';

  const lines: string[] = [];
  lines.push(car ? `*${category} — ${car}*` : `*${category}*`);
  lines.push('');

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

  lines.push('Reply with plan number to proceed, or type *book* 😊');
  return lines.join('\n').trim();
}

import type { WhatsAppListSection } from '@/lib/services/whatsappService';

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
        const points = getPlanPoints(plan);
        const price = inr(plan.min_price);
        return {
          id: `${prefix}_${index + 1}`.slice(0, 200),
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

export function canSendPeriodicPlanList(plans: PricingPlanItem[]): boolean {
  return buildPeriodicPlanListSections(plans).length > 0;
}

export function extractCarModelFromMessage(message: string): string | null {
  const m = String(message || '').match(/for\s+([a-z0-9][a-z0-9\s-]{0,24}?)\s+in\s+\d{6}/i);
  if (m?.[1]) return m[1].trim();
  const m2 = String(message || '').match(/for\s+(?:my\s+)?([a-z0-9][a-z0-9\s-]{0,24}?)(?:\s|$|\?)/i);
  return m2?.[1]?.trim() || null;
}
