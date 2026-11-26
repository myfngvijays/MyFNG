import { supabase } from './supabase';
import type { BookingDraft } from './bookingDraft';
import { getDraftDisplayPrices } from './bookingDraft';
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

/**
 * Resolve customer-facing service price from workshop_service_pricing.
 * Zone-level (city_id null) matches Zone Prices before city overrides;
 * lowest price among matching workshop rows.
 */
export async function fetchServicePriceForBooking(
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
  serviceTypeIds: string[],
  cityId: string | null,
  zoneId: string | null,
  vehicleClass: string | null,
): Promise<Record<string, number>> {
  const next: Record<string, number> = {};
  await Promise.all(
    serviceTypeIds.map(async (id) => {
      const p = await fetchServicePriceForBooking(id, cityId, zoneId, vehicleClass);
      if (p > 0) next[id] = p;
    }),
  );
  return next;
}

export async function resolveCityZoneId(cityId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('cities').select('zone_id').eq('id', cityId).maybeSingle();
    return String((data as { zone_id?: string })?.zone_id || '').trim() || null;
  } catch {
    return null;
  }
}

export async function resolveVehicleClass(carModelId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('car_models').select('class').eq('id', carModelId).maybeSingle();
    return String((data as { class?: string })?.class || '').trim() || null;
  } catch {
    return null;
  }
}

/** Resolve car_models id + class from make/model names when model_id is missing. */
export async function resolveVehicleClassByMakeModel(
  make: string | null | undefined,
  model: string | null | undefined,
): Promise<{ id: string | null; class: string | null }> {
  const m = String(make || '').trim();
  const mod = String(model || '').trim();
  if (!m || !mod) return { id: null, class: null };
  try {
    const makeToken = m.split(/\s+/)[0] || m;
    const modelToken = mod.split(/\s+/)[0] || mod;
    const { data } = await supabase
      .from('car_models')
      .select('id, class')
      .eq('is_active', true)
      .ilike('make', `%${makeToken}%`)
      .ilike('model_name', `%${modelToken}%`)
      .order('model_name')
      .limit(1)
      .maybeSingle();
    const id = String((data as { id?: string })?.id || '').trim() || null;
    const cls = String((data as { class?: string })?.class || '').trim() || null;
    return { id, class: cls };
  } catch {
    return { id: null, class: null };
  }
}

export async function fetchDraftServicePricing(draft: BookingDraft): Promise<Record<string, number>> {
  const sessionPrices = getDraftDisplayPrices(draft);
  if (Object.keys(sessionPrices).length > 0) return sessionPrices;

  const serviceIds = draft.selectedServices || [];
  if (serviceIds.length === 0) return {};

  const cityId = draft.city?.id || null;
  const zoneId = cityId ? await resolveCityZoneId(cityId) : null;
  const vehicleClass = draft.carModel?.id ? await resolveVehicleClass(draft.carModel.id) : null;

  return fetchServicePricingMap(serviceIds, cityId, zoneId, vehicleClass);
}