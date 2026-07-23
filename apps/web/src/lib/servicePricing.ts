/**
 * Customer-facing price resolution from workshop_service_pricing.
 * Same tier order as book-service page and mobile app.
 */

import { isPremiumLuxuryClass } from './vehicleClassPricing';

function toPrice(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type SupabaseClient = {
  from: (table: string) => any;
};

export async function fetchServicePriceForBooking(
  supabase: SupabaseClient,
  serviceTypeId: string,
  cityId: string | null,
  zoneId: string | null,
  vehicleClass: string | null,
): Promise<number> {
  const tryPrice = async (filters: Record<string, string | null>) => {
    let q = supabase
      .from('workshop_service_pricing')
      .select('custom_price')
      .eq('service_type_id', serviceTypeId)
      .eq('is_active', true)
      .limit(1);

    for (const [k, v] of Object.entries(filters)) {
      if (v === null) q = q.is(k, null);
      else q = q.eq(k, v);
    }

    const { data } = await q.maybeSingle();
    return toPrice((data as { custom_price?: number })?.custom_price);
  };

  if (cityId && vehicleClass) {
    const p = await tryPrice({ city_id: cityId, class: vehicleClass });
    if (p) return p;
  }
  if (!isPremiumLuxuryClass(vehicleClass)) {
    if (cityId) {
      const p = await tryPrice({ city_id: cityId, class: null });
      if (p) return p;
    }
  }
  if (zoneId && vehicleClass) {
    const p = await tryPrice({ zone_id: zoneId, class: vehicleClass });
    if (p) return p;
  }
  if (!isPremiumLuxuryClass(vehicleClass)) {
    if (zoneId) {
      const p = await tryPrice({ zone_id: zoneId, class: null });
      if (p) return p;
    }
  }
  if (vehicleClass) {
    const p = await tryPrice({ class: vehicleClass, city_id: null, zone_id: null });
    if (p) return p;
  }

  if (isPremiumLuxuryClass(vehicleClass)) {
    return 0;
  }

  // Last resort — any active row (matches book-service step 6)
  const { data } = await supabase
    .from('workshop_service_pricing')
    .select('custom_price')
    .eq('service_type_id', serviceTypeId)
    .eq('is_active', true)
    .gt('custom_price', 0)
    .order('custom_price', { ascending: true })
    .limit(1)
    .maybeSingle();

  return toPrice((data as { custom_price?: number })?.custom_price);
}

export function normalizeCategoryKey(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/^car\s+/i, '')
    .replace(/\s+service$/i, '')
    .replace(/[^a-z0-9]/g, '');
}

export function matchCategoryRow(
  input: string,
  rows: Array<{ uuid: string; category: string }>,
): { uuid: string; category: string } | null {
  if (!rows.length) return null;

  const inputNorm = normalizeCategoryKey(input);
  if (!inputNorm) return null;

  const scored = rows
    .map((row) => {
      const rowNorm = normalizeCategoryKey(row.category);
      let score = 0;
      if (rowNorm === inputNorm) score = 100;
      else if (rowNorm.includes(inputNorm) || inputNorm.includes(rowNorm)) score = 80;
      else {
        const inputTokens = inputNorm.match(/[a-z0-9]+/g) || [];
        const rowTokens = rowNorm.match(/[a-z0-9]+/g) || [];
        const overlap = inputTokens.filter((t) => rowTokens.some((r) => r.includes(t) || t.includes(r))).length;
        if (overlap > 0) score = 50 + overlap * 10;
      }
      return { row, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.row || null;
}
