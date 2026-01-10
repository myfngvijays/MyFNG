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

async function fetchCityZoneId(supabase: any, cityId?: string | null) {
  if (!cityId) return null;
  const { data } = await supabase.from('cities').select('zone_id').eq('id', cityId).maybeSingle();
  return ((data as any)?.zone_id as string) || null;
}

export async function resolveWorkshopServicePrice(input: {
  supabase: any;
  workshopId: string;
  serviceTypeId: string;
  cityId?: string | null;
  zoneId?: string | null;
  vehicleClass?: string | null;
}): Promise<number> {
  const { supabase, workshopId, serviceTypeId } = input;
  const cityId = input.cityId || null;
  const vehicleClass = input.vehicleClass || null;
  const zoneId = input.zoneId || (await fetchCityZoneId(supabase, cityId));

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
      p_zone_id: zoneId,
    } as any);
    const rpcPrice = toNumber(data);
    if (rpcPrice > 0) return rpcPrice;
  } catch {
    // ignore
  }

  // 1) City + Class
  if (cityId && vehicleClass) {
    const p = await tryPrice({ city_id: cityId, class: vehicleClass });
    if (p) return p;
  }
  // 2) City only
  if (cityId) {
    const p = await tryPrice({ city_id: cityId, class: null });
    if (p) return p;
  }
  // 3) Zone + Class
  if (zoneId && vehicleClass) {
    const p = await tryPrice({ zone_id: zoneId, class: vehicleClass });
    if (p) return p;
  }
  // 4) Zone only
  if (zoneId) {
    const p = await tryPrice({ zone_id: zoneId, class: null });
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

