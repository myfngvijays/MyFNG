/**
 * Customer-facing price resolution from workshop_service_pricing.
 * Aligns with Zone Prices (zone-level, city_id null) before city overrides;
 * when several workshop rows match, uses the lowest active price.
 */

import { isPremiumLuxuryClass } from './vehicleClassPricing';

function toPrice(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function pickBestCustomerPrice(raw: unknown[]): number {
  const prices = raw.map(toPrice).filter((p) => p > 0);
  if (!prices.length) return 0;
  return Math.min(...prices);
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
  const tryBestPrice = async (filters: Record<string, string | null>) => {
    let q = supabase
      .from('workshop_service_pricing')
      .select('custom_price')
      .eq('service_type_id', serviceTypeId)
      .eq('is_active', true)
      .limit(200);

    for (const [k, v] of Object.entries(filters)) {
      if (v === null) q = q.is(k, null);
      else q = q.eq(k, v);
    }

    const { data } = await q;
    return pickBestCustomerPrice((data || []).map((row: { custom_price?: unknown }) => row.custom_price));
  };

  // 1–2: Zone Prices sheet (zone + class, city_id null) before city overrides
  if (zoneId && vehicleClass) {
    const p = await tryBestPrice({ zone_id: zoneId, class: vehicleClass, city_id: null });
    if (p) return p;
  }
  if (!isPremiumLuxuryClass(vehicleClass) && zoneId) {
    const p = await tryBestPrice({ zone_id: zoneId, class: null, city_id: null });
    if (p) return p;
  }

  if (cityId && vehicleClass) {
    const p = await tryBestPrice({ city_id: cityId, class: vehicleClass });
    if (p) return p;
  }
  if (!isPremiumLuxuryClass(vehicleClass) && cityId) {
    const p = await tryBestPrice({ city_id: cityId, class: null });
    if (p) return p;
  }

  if (vehicleClass) {
    const p = await tryBestPrice({ class: vehicleClass, city_id: null, zone_id: null });
    if (p) return p;
  }

  return 0;
}

export async function fetchServicePricingMap(
  supabase: SupabaseClient,
  serviceTypeIds: string[],
  cityId: string | null,
  zoneId: string | null,
  vehicleClass: string | null,
): Promise<Record<string, number>> {
  const next: Record<string, number> = {};
  await Promise.all(
    serviceTypeIds.map(async (id) => {
      const p = await fetchServicePriceForBooking(supabase, id, cityId, zoneId, vehicleClass);
      if (p > 0) next[id] = p;
    }),
  );
  return next;
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