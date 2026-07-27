import { supabase } from './supabase';
import type { BookingDraft } from './bookingDraft';
import { getDraftDisplayPrices } from './bookingDraft';
import { isPremiumLuxuryClass } from './vehicleClassPricing';

/**
 * Resolve customer-facing service price from workshop_service_pricing.
 * Only returns a price when city / zone / class tier matches — never falls back
 * to unrelated workshop rows (avoids showing placeholder values like 101, 102…).
 * Premium luxury: exact class tier only — no generic fallbacks.
 */
export async function fetchServicePriceForBooking(
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
    const p = Number((data as { custom_price?: number })?.custom_price || 0);
    return Number.isFinite(p) && p > 0 ? p : 0;
  };

  if (cityId && vehicleClass) {
    const p = await tryPrice({ city_id: cityId, class: vehicleClass });
    if (p) return p;
  }
  if (!isPremiumLuxuryClass(vehicleClass) && cityId) {
    const p = await tryPrice({ city_id: cityId, class: null });
    if (p) return p;
  }
  if (zoneId && vehicleClass) {
    const p = await tryPrice({ zone_id: zoneId, class: vehicleClass });
    if (p) return p;
  }
  if (!isPremiumLuxuryClass(vehicleClass) && zoneId) {
    const p = await tryPrice({ zone_id: zoneId, class: null });
    if (p) return p;
  }
  if (vehicleClass) {
    const p = await tryPrice({ class: vehicleClass, city_id: null, zone_id: null });
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
