/**
 * Workshop service pricing resolver.
 * Priority mirrors pricing tier rules:
 * City+Class > City (class null) > Zone+Class > Zone (class null) > Class-only > Default.
 */

function toNumber(v: any): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function fetchCityRow(supabase: any, cityId?: string | null) {
  if (!cityId) return null;
  const { data } = await supabase.from('cities').select('id, zone_id, name').eq('id', cityId).maybeSingle();
  return (data as any) || null;
}

async function resolveCityIdByName(supabase: any, cityName?: string | null, zoneId?: string | null) {
  const name = String(cityName || '').trim();
  if (!name) return null;

  // Try constrained by zone first (more accurate).
  if (zoneId) {
    const { data } = await supabase
      .from('cities')
      .select('id')
      .eq('zone_id', zoneId)
      .ilike('name', name)
      .limit(1);
    const id = String((data?.[0] as any)?.id || '').trim();
    if (id) return id;
  }

  // Fallback: by name only.
  const { data } = await supabase.from('cities').select('id').ilike('name', name).limit(1);
  const id = String((data?.[0] as any)?.id || '').trim();
  return id || null;
}

export async function resolveWorkshopServicePrice(input: {
  supabase: any;
  workshopId: string;
  serviceTypeId: string;
  cityId?: string | null;
  cityName?: string | null;
  zoneId?: string | null;
  workshopZoneId?: string | null;
  vehicleClass?: string | null;
}): Promise<number> {
  const { supabase, workshopId, serviceTypeId } = input;
  const requestedCityId = input.cityId || null;
  const vehicleClass = input.vehicleClass || null;

  // Resolve effective city_id + zone_id robustly:
  // - Some leads have placeholder/incorrect city_id. In that case, try cityName + workshopZoneId to find cities.id.
  const cityRow = await fetchCityRow(supabase, requestedCityId);
  const effectiveZoneId =
    input.zoneId ||
    input.workshopZoneId ||
    (String((cityRow as any)?.zone_id || '').trim() || null) ||
    null;

  const effectiveCityId =
    (String((cityRow as any)?.id || '').trim() || null) ||
    (await resolveCityIdByName(supabase, input.cityName || null, effectiveZoneId));

  async function tryPrice(filters: Record<string, any>) {
    let q = supabase
      .from('workshop_service_pricing')
      .select('custom_price')
      .eq('workshop_id', workshopId)
      .eq('service_type_id', serviceTypeId)
      .eq('is_active', true)
      .limit(1);

    for (const [k, v] of Object.entries(filters)) {
      if (v === null) q = q.is(k, null);
      else q = q.eq(k, v);
    }

    const { data } = await q.maybeSingle();
    const p = toNumber((data as any)?.custom_price);
    return p > 0 ? p : 0;
  }

  // 0) RPC (optional): some installs expose this helper
  try {
    const { data } = await supabase.rpc('get_service_price', {
      p_workshop_id: workshopId,
      p_service_type_id: serviceTypeId,
      p_vehicle_class: vehicleClass,
      p_zone_id: effectiveZoneId,
    } as any);
    const rpcPrice = toNumber(data);
    if (rpcPrice > 0) return rpcPrice;
  } catch {
    // ignore
  }

  // 1) City + Class
  if (effectiveCityId && vehicleClass) {
    const p = await tryPrice({ city_id: effectiveCityId, class: vehicleClass });
    if (p) return p;
  }
  // 2) City only
  if (effectiveCityId) {
    const p = await tryPrice({ city_id: effectiveCityId, class: null });
    if (p) return p;
  }
  // 3) Zone + Class
  if (effectiveZoneId && vehicleClass) {
    const p = await tryPrice({ zone_id: effectiveZoneId, class: vehicleClass });
    if (p) return p;
  }
  // 4) Zone only
  if (effectiveZoneId) {
    const p = await tryPrice({ zone_id: effectiveZoneId, class: null });
    if (p) return p;
  }
  // 5) Class only
  if (vehicleClass) {
    const p = await tryPrice({ class: vehicleClass, city_id: null, zone_id: null });
    if (p) return p;
  }

  // 6) Default row (no city/zone/class)
  try {
    const p = await tryPrice({ city_id: null, zone_id: null, class: null });
    if (p) return p;
  } catch {
    // ignore
  }

  return 0;
}

/**
 * Match the public customer page pricing behavior:
 * - Try RPC get_service_price(workshop_id, service_type_id, vehicle_class=null, zone_id=null)
 * - Else pick "best available" workshop_service_pricing row by ordering (city_id > zone_id > class > created_at),
 *   WITHOUT filtering by the lead's specific city/class.
 *
 * This is intentionally permissive to mirror existing production behavior.
 */
export async function resolveWorkshopServicePriceBestAvailable(input: {
  supabase: any;
  workshopId: string;
  serviceTypeId: string;
}): Promise<number> {
  const { supabase, workshopId, serviceTypeId } = input;

  // 1) RPC helper (public page passes null vehicle_class + null zone)
  try {
    const { data } = await supabase.rpc('get_service_price', {
      p_workshop_id: workshopId,
      p_service_type_id: serviceTypeId,
      p_vehicle_class: null,
      p_zone_id: null,
    } as any);
    const rpcPrice = toNumber(data);
    if (rpcPrice > 0) return rpcPrice;
  } catch {
    // ignore
  }

  // 2) Best available row (same ordering as public lead API)
  try {
    const attempt = await supabase
      .from('workshop_service_pricing')
      .select('custom_price, city_id, zone_id, class, created_at')
      .eq('workshop_id', workshopId)
      .eq('service_type_id', serviceTypeId)
      .eq('is_active', true)
      .order('city_id', { ascending: false, nullsFirst: false } as any)
      .order('zone_id', { ascending: false, nullsFirst: false } as any)
      .order('class', { ascending: false, nullsFirst: false } as any)
      .order('created_at', { ascending: false } as any)
      .limit(1);

    const p = toNumber((attempt.data?.[0] as any)?.custom_price);
    if (p > 0) return p;
  } catch {
    // ignore
  }

  return 0;
}

