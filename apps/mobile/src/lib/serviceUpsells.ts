/**
 * Category-based service upsell engine.
 *
 * For each selected category, suggests the best representative service
 * from every complementary category. Picks maintenance-oriented services
 * over emergency/repair ones.
 */

type ServiceTypeRow = {
  id: string;
  name: string;
  description?: string | null;
  category_uuid?: string | null;
  category?: string;
  points?: number;
};

/**
 * Ordered list of related categories for each source category.
 * Earlier entries = higher relevance. Every category maps to most
 * other categories since cross-category upsell is the goal.
 */
const CATEGORY_RELATIONSHIPS: Record<string, string[]> = {
  PERIODIC: ['AC', 'DETAILING', 'TYRE', 'WHEEL', 'BRAKE', 'BATTERY', 'CLUTCH', 'ENGINE', 'DENTING', 'PAINTING'],
  AC: ['PERIODIC', 'DETAILING', 'BATTERY', 'ENGINE', 'ELECTRICAL'],
  BATTERY: ['PERIODIC', 'AC', 'ENGINE', 'ELECTRICAL'],
  BRAKE: ['TYRE', 'WHEEL', 'PERIODIC', 'SUSPENSION', 'CLUTCH'],
  CLUTCH: ['PERIODIC', 'ENGINE', 'BRAKE'],
  DENTING: ['PAINTING', 'DETAILING', 'PERIODIC'],
  PAINTING: ['DENTING', 'DETAILING', 'PERIODIC'],
  DETAILING: ['PERIODIC', 'AC', 'DENTING', 'PAINTING', 'TYRE', 'WHEEL'],
  ENGINE: ['PERIODIC', 'AC', 'BATTERY', 'CLUTCH'],
  TYRE: ['WHEEL', 'BRAKE', 'PERIODIC', 'SUSPENSION'],
  WHEEL: ['TYRE', 'BRAKE', 'PERIODIC'],
  ELECTRICAL: ['BATTERY', 'AC', 'PERIODIC'],
  SUSPENSION: ['BRAKE', 'TYRE', 'WHEEL', 'PERIODIC', 'STEERING'],
  STEERING: ['SUSPENSION', 'TYRE', 'PERIODIC'],
};

/**
 * Skip these services entirely — individual panel paint jobs
 * aren't meaningful upsells. Only keep category-level services.
 */
const SKIP_PATTERNS = [
  /^(front|rear|left|right)\s+(bumper|fender|door|quarter)/i,
  /^bonnet\s+paint/i,
  /^car\s+dicky\s+paint/i,
  /^roof\s+top\s+paint/i,
];

function shouldSkipService(name: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(name));
}

/**
 * Score a service for upsell quality.
 * Higher = better upsell candidate. Returns -1 to exclude entirely.
 */
function upsellScore(service: ServiceTypeRow, price: number): number {
  const name = (service.name || '').toLowerCase();

  if (shouldSkipService(service.name || '')) return -1;

  let score = 10;

  // Prefer broad service packages over narrow repair items
  if (/service|package|care|maintenance/i.test(name)) score += 20;
  if (/cleaning|wash|spa|polish|coating|detailing/i.test(name)) score += 15;
  if (/charging|recharge|gas|refill|top.?up/i.test(name)) score += 12;
  if (/alignment|balancing|tune/i.test(name)) score += 12;
  if (/inspection|check|diagnostic|scanning/i.test(name)) score += 10;
  if (/ceramic|teflon|3m|wax|protection/i.test(name)) score += 10;
  if (/deep|complete|full|360|all.?round|premium/i.test(name)) score += 5;

  // Deprioritise emergency/heavy repair
  if (/jump\s*start|towing|roadside|emergency|breakdown/i.test(name)) score -= 25;
  if (/replacement|replace|overhaul|rebuild/i.test(name)) score -= 15;
  if (/full\s*body\s*painting/i.test(name)) score -= 5;

  // Prefer priced services (show value)
  if (price > 0) score += 5;
  // Moderate price range ideal for upsells
  if (price > 0 && price <= 2000) score += 3;

  return score;
}

function matchCategoryKey(category: string): string | undefined {
  const upper = category.toUpperCase();
  return Object.keys(CATEGORY_RELATIONSHIPS).find((k) => upper.includes(k));
}

export function getUpsellSuggestions(
  selectedServiceIds: string[],
  allServices: ServiceTypeRow[],
  pricing: Record<string, number>,
): ServiceTypeRow[] {
  if (selectedServiceIds.length === 0 || allServices.length === 0) return [];

  const selectedSet = new Set(selectedServiceIds);

  const selectedCategories = new Set<string>();
  const selectedCategoryKeys = new Set<string>();
  for (const sid of selectedServiceIds) {
    const svc = allServices.find((s) => s.id === sid);
    if (svc?.category) {
      selectedCategories.add(svc.category);
      const key = matchCategoryKey(svc.category);
      if (key) selectedCategoryKeys.add(key);
    }
  }

  // Build ordered list of target category keys
  const targetKeys: string[] = [];
  for (const cat of selectedCategories) {
    const key = matchCategoryKey(cat);
    if (!key) continue;
    const related = CATEGORY_RELATIONSHIPS[key] || [];
    for (const r of related) {
      if (!targetKeys.includes(r) && !selectedCategoryKeys.has(r)) {
        targetKeys.push(r);
      }
    }
  }

  // For each target category key, find the best service
  const result: ServiceTypeRow[] = [];

  for (const targetKey of targetKeys) {
    const candidates = allServices.filter((s) => {
      if (selectedSet.has(s.id)) return false;
      if (!s.category) return false;
      const key = matchCategoryKey(s.category);
      if (key !== targetKey) return false;
      if (selectedCategories.has(s.category)) return false;
      const score = upsellScore(s, pricing[s.id] || 0);
      return score > 0;
    });

    if (candidates.length === 0) continue;

    candidates.sort((a, b) => {
      const sa = upsellScore(a, pricing[a.id] || 0);
      const sb = upsellScore(b, pricing[b.id] || 0);
      return sb - sa;
    });

    result.push(candidates[0]);
  }

  return result;
}

export function getUpsellHeading(selectedCategories: Set<string>): string {
  if (selectedCategories.size === 0) return 'You might also need';

  for (const cat of selectedCategories) {
    const upper = cat.toUpperCase();
    if (upper.includes('PERIODIC')) return 'Commonly booked together';
    if (upper.includes('AC')) return 'Complete your car care';
    if (upper.includes('DENTING') || upper.includes('PAINTING'))
      return 'Make it showroom fresh';
    if (upper.includes('DETAILING')) return 'While your car is with us';
    if (upper.includes('TYRE') || upper.includes('BRAKE'))
      return "Don't miss these safety checks";
  }

  return 'You might also need';
}
