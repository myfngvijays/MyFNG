export type OilType = 'semi' | 'full' | 'unknown';

export type MisaPricingPlan = {
  id: string;
  name: string;
  tier: string;
  oilType: OilType;
  price: number;
  description: string;
  isPeriodic: boolean;
  serviceTypeId?: string | null;
  checklistCount?: number;
  checklistPreview?: string[];
  checklistItems?: Array<{ name: string; category: string }>;
  points?: string | null;
  badge?: string | null;
};

function normalizeChecklistItems(raw: unknown): Array<{ name: string; category: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') {
        const name = item.trim();
        return name ? { name, category: 'General' } : null;
      }
      const name = String((item as any)?.name || (item as any)?.title || (item as any)?.label || '').trim();
      if (!name) return null;
      return { name, category: String((item as any)?.category || 'General').trim() || 'General' };
    })
    .filter(Boolean) as Array<{ name: string; category: string }>;
}

function normalizeChecklistPreview(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      const name = String((item as any)?.name || (item as any)?.title || (item as any)?.label || '').trim();
      return name;
    })
    .filter(Boolean)
    .slice(0, 4);
}

export function isKnownPeriodicTier(tier: string): boolean {
  return /basic|general|premium|platinum/i.test(String(tier || ''));
}

function cleanPlanName(raw: string): string {
  return String(raw || '')
    .replace(/\*\*/g, '')
    .replace(/[✨━─📝💰]/g, '')
    .replace(/^[\d️⃣]+[\s.)-]*/i, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/\s*[-–—:]\s*₹.*$/i, '')
    .replace(/\s*₹.*$/i, '')
    .trim();
}

function isPeriodicPlanName(name: string): boolean {
  return /basic|general|premium|platinum/i.test(String(name || ''));
}

export function getOilTypeForPlan(name: string, description = ''): OilType {
  const text = `${String(name || '')} ${String(description || '')}`.toLowerCase();
  const hasSemi =
    text.includes('semi synthetic') ||
    text.includes('semi-synthetic') ||
    text.includes('(semi)') ||
    /\bsemi\b/.test(text);
  const hasFull =
    text.includes('fully synthetic') ||
    text.includes('full synthetic') ||
    text.includes('(fully)') ||
    text.includes('(full)') ||
    /\bfully\b/.test(text);
  if (hasSemi && hasFull) return 'unknown';
  if (hasFull) return 'full';
  if (hasSemi) return 'semi';
  return 'unknown';
}

export function getPlanTierLabel(name: string): string {
  const n = String(name || '').toLowerCase();
  if (n.includes('platinum')) return 'Platinum';
  if (n.includes('premium')) return 'Premium';
  if (n.includes('general')) return 'General';
  if (n.includes('basic')) return 'Basic';
  return cleanPlanName(name);
}

export function getPlanBadge(name: string): string | null {
  const n = String(name || '').toLowerCase();
  if (n.includes('general')) return 'Most Popular';
  if (n.includes('premium')) return 'Best Value';
  if (n.includes('platinum')) return 'Top Tier';
  return null;
}

export function getPlanPoints(name: string, description = ''): string | null {
  const text = `${name} ${description}`;
  const pointsMatch = text.match(/(\d+)\s*points?/i);
  if (pointsMatch) return pointsMatch[1];
  const checkpointMatch = text.match(/(\d+)\s*checkpoint/i);
  if (checkpointMatch) return checkpointMatch[1];
  return null;
}

function buildPlanFromHeader(
  headerLine: string,
  price: number,
  description: string,
  index: number,
): MisaPricingPlan | null {
  if (!headerLine || !price) return null;
  const periodic = isPeriodicPlanName(headerLine);
  const oilType = getOilTypeForPlan(headerLine, description);
  const tier = periodic ? getPlanTierLabel(headerLine) : headerLine;
  return {
    id: `plan-${index}-${oilType}-${tier.toLowerCase().replace(/\s+/g, '-')}`,
    name: headerLine,
    tier,
    oilType,
    price,
    description,
    isPeriodic: periodic,
    points: getPlanPoints(headerLine, description),
    badge: getPlanBadge(headerLine),
  };
}

function parseNumberedBlocks(text: string): MisaPricingPlan[] {
  const plans: MisaPricingPlan[] = [];
  const normalized = String(text || '');
  const blockRe = /\*\*[\d]+️⃣\s*([\s\S]*?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(normalized)) !== null) {
    const headerLine = cleanPlanName(match[1] || '');
    if (!headerLine) continue;
    const after = normalized.slice(match.index + match[0].length, match.index + match[0].length + 280);
    const priceMatch = after.match(/₹\s*([\d,]+)/);
    if (!priceMatch) continue;
    const price = Number(priceMatch[1].replace(/,/g, ''));
    const plan = buildPlanFromHeader(headerLine, price, '', plans.length);
    if (plan) plans.push(plan);
  }
  return plans;
}

export function parsePricingPlansFromText(text: string): MisaPricingPlan[] {
  const fromBlocks = parseNumberedBlocks(text);
  if (fromBlocks.length) return fromBlocks;
  const lines = String(text || '').split('\n');
  const plans: MisaPricingPlan[] = [];
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!/₹\s*[\d,]+/.test(line)) return;
    const priceMatch = line.match(/₹\s*([\d,]+)/);
    if (!priceMatch) return;
    let headerLine = cleanPlanName(line.split(/₹/)[0] || '');
    let description = '';
    if (!headerLine || headerLine.length < 3) {
      for (let i = index - 1; i >= 0; i -= 1) {
        const prev = lines[i]?.trim();
        if (!prev || /₹/.test(prev)) break;
        const candidate = cleanPlanName(prev);
        if (candidate.length >= 3) {
          headerLine = candidate;
          break;
        }
      }
    }
    const descMatch = lines[index + 1]?.trim();
    if (descMatch && !/₹\s*[\d,]+/.test(descMatch)) description = cleanPlanName(descMatch);
    if (!headerLine) return;
    const plan = buildPlanFromHeader(headerLine, Number(priceMatch[1].replace(/,/g, '')), description, plans.length);
    if (plan) plans.push(plan);
  });
  return plans;
}

export function buildPricingPlansFromApi(rows: any[]): MisaPricingPlan[] {
  return (rows || []).map((p, index) => {
    const name = String(p?.service_name || '').trim();
    const description = String(p?.description || '');
    const periodic = isPeriodicPlanName(name);
    const oilType = getOilTypeForPlan(name, description);
    const parsedPoints = getPlanPoints(name, description);
    const preview = normalizeChecklistPreview(p?.checklist_items);
    const checklistItems = normalizeChecklistItems(p?.checklist_items);
    const checklistCount = checklistItems.length > 0 ? checklistItems.length : Number(p?.checklist_count || 0);
    const pointsValue =
      typeof p?.points === 'number' && p.points > 0
        ? String(p.points)
        : parsedPoints
          ? parsedPoints
          : checklistCount > 0
            ? String(checklistCount)
            : null;
    return {
      id: `api-${index}-${p?.service_type_id || name}-${oilType}`,
      name,
      tier: periodic ? getPlanTierLabel(name) : name,
      oilType,
      price: Number(p?.min_price || 0),
      description,
      isPeriodic: periodic,
      serviceTypeId: p?.service_type_id || null,
      checklistCount,
      checklistPreview: preview,
      checklistItems,
      points: pointsValue,
      badge: getPlanBadge(name),
    };
  });
}

export function groupPeriodicPlans(plans: MisaPricingPlan[]) {
  const semi = plans.filter((p) => getOilTypeForPlan(p.name, p.description) === 'semi');
  const full = plans.filter((p) => getOilTypeForPlan(p.name, p.description) === 'full');
  const unknown = plans.filter((p) => getOilTypeForPlan(p.name, p.description) === 'unknown');
  return { semi, full, unknown };
}

export function isPeriodicPricing(plans: MisaPricingPlan[]): boolean {
  if (!plans.length) return false;
  const grouped = groupPeriodicPlans(plans);
  return grouped.semi.length > 0 || grouped.full.length > 0 || plans.some((p) => p.isPeriodic);
}

export function assistantMessageShowsPricingList(text: string): boolean {
  const t = String(text || '');
  const prices = (t.match(/₹\s*[\d,]+/g) || []).length;
  if (prices >= 1 && /service for your|for your/i.test(t)) return true;
  if (prices >= 2) return true;
  const tiers = /basic service|general service|premium service|platinum service/i.test(t);
  return prices >= 1 && tiers;
}

export function mergePricingPlans(apiPlans: MisaPricingPlan[], textPlans: MisaPricingPlan[]): MisaPricingPlan[] {
  const merged = [...apiPlans];
  const key = (p: MisaPricingPlan) =>
    `${p.tier}|${getOilTypeForPlan(p.name, p.description)}|${p.price}|${p.name}`.toLowerCase();
  const seen = new Set(merged.map(key));
  for (const plan of textPlans) {
    const k = key(plan);
    if (!seen.has(k)) {
      merged.push(plan);
      seen.add(k);
    }
  }
  return merged.sort((a, b) => a.price - b.price);
}

export function resolveMessagePricingPlans(apiPlans: MisaPricingPlan[] | undefined, text: string): MisaPricingPlan[] {
  const fromApi = apiPlans || [];
  const fromText = parsePricingPlansFromText(text);
  if (fromApi.length === 0) return fromText;
  if (fromText.length === 0) return fromApi;
  return mergePricingPlans(fromApi, fromText);
}

export function extractPricingTitle(text: string): string {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const cleaned = line.replace(/\*\*/g, '').replace(/[✨━─]/g, '').trim();
    if (/service for your|for your/i.test(cleaned)) return cleaned;
  }
  const m = String(text || '').match(/\*\*(.+?)\*\*/);
  return m?.[1]?.trim() || 'Choose your service plan';
}
