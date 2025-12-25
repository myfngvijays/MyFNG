import type { ChatbotContext, PriceRange, ServiceSuggestion } from './types';

function toNumber(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function roundToStep(value: number, step: number, dir: 'down' | 'up') {
  if (step <= 0) return value;
  return dir === 'down' ? Math.floor(value / step) * step : Math.ceil(value / step) * step;
}

function chooseStep(value: number) {
  if (value >= 20000) return 1000;
  if (value >= 5000) return 500;
  return 100;
}

function formatInr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function makeRangeFromExact(exact: number, source: PriceRange['source']): PriceRange | null {
  if (!Number.isFinite(exact) || exact <= 0) return null;
  // Never show exact: fuzz range by +-10%..20%, then round.
  const minRaw = exact * 0.9;
  const maxRaw = exact * 1.2;
  const step = chooseStep(exact);
  const min = roundToStep(minRaw, step, 'down');
  const max = roundToStep(maxRaw, step, 'up');
  return {
    currency: 'INR',
    min,
    max: Math.max(max, min + step),
    label: `${formatInr(min)} – ${formatInr(Math.max(max, min + step))}`,
    source,
  };
}

async function fetchCityZoneId(supabase: any, cityId?: string | null) {
  if (!cityId) return null;
  const { data } = await supabase.from('cities').select('zone_id').eq('id', cityId).maybeSingle();
  return ((data as any)?.zone_id as string) || null;
}

function toExactPrice(exact: number, source: PriceRange['source']) {
  if (!Number.isFinite(exact) || exact <= 0) return null;
  return { currency: 'INR' as const, amount: Math.round(exact), source };
}

async function getPackagePriceRange(supabase: any, packageId: string): Promise<PriceRange | null> {
  const { data, error } = await supabase
    .from('service_packages')
    .select('total_price')
    .eq('id', packageId)
    .single();
  if (error) return null;

  const total = toNumber((data as any)?.total_price);
  return makeRangeFromExact(total, 'service_packages');
}

async function getPackageExactPrice(supabase: any, packageId: string) {
  const { data, error } = await supabase
    .from('service_packages')
    .select('total_price')
    .eq('id', packageId)
    .single();
  if (error) return null;
  const total = toNumber((data as any)?.total_price);
  return toExactPrice(total, 'service_packages');
}

async function getServiceTypePriceRange(supabase: any, ctx: ChatbotContext, serviceTypeId: string): Promise<PriceRange | null> {
  // Mirror /book-service pricing priority:
  // City+Class > City > Zone+Class > Zone > Class-only > default (null)
  const cityId = ctx.cityId || null;
  const vehicleClass = ctx.vehicleClass || null;
  const zoneId = ctx.zoneId || (await fetchCityZoneId(supabase, cityId));

  async function tryPrice(filters: Record<string, any>) {
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
    const p = toNumber((data as any)?.custom_price);
    return p > 0 ? p : 0;
  }

  // Priority 1: City + Class
  if (cityId && vehicleClass) {
    const p = await tryPrice({ city_id: cityId, class: vehicleClass });
    if (p) return makeRangeFromExact(p, 'workshop_service_pricing');
  }

  // Priority 2: City only (class null)
  if (cityId) {
    const p = await tryPrice({ city_id: cityId, class: null });
    if (p) return makeRangeFromExact(p, 'workshop_service_pricing');
  }

  // Priority 3: Zone + Class
  if (zoneId && vehicleClass) {
    const p = await tryPrice({ zone_id: zoneId, class: vehicleClass });
    if (p) return makeRangeFromExact(p, 'workshop_service_pricing');
  }

  // Priority 4: Zone only (class null)
  if (zoneId) {
    const p = await tryPrice({ zone_id: zoneId, class: null });
    if (p) return makeRangeFromExact(p, 'workshop_service_pricing');
  }

  // Priority 5: Class only (no city/zone)
  if (vehicleClass) {
    const p = await tryPrice({ class: vehicleClass, city_id: null, zone_id: null });
    if (p) return makeRangeFromExact(p, 'workshop_service_pricing');
  }

  return null;
}

async function getServiceTypeExactPrice(supabase: any, ctx: ChatbotContext, serviceTypeId: string) {
  // Mirror /book-service pricing priority:
  // City+Class > City > Zone+Class > Zone > Class-only > default (null)
  const cityId = ctx.cityId || null;
  const vehicleClass = ctx.vehicleClass || null;
  const zoneId = ctx.zoneId || (await fetchCityZoneId(supabase, cityId));

  async function tryPrice(filters: Record<string, any>) {
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
    const p = toNumber((data as any)?.custom_price);
    return p > 0 ? p : 0;
  }

  // Priority 1: City + Class
  if (cityId && vehicleClass) {
    const p = await tryPrice({ city_id: cityId, class: vehicleClass });
    if (p) return toExactPrice(p, 'workshop_service_pricing');
  }

  // Priority 2: City only (class null)
  if (cityId) {
    const p = await tryPrice({ city_id: cityId, class: null });
    if (p) return toExactPrice(p, 'workshop_service_pricing');
  }

  // Priority 3: Zone + Class
  if (zoneId && vehicleClass) {
    const p = await tryPrice({ zone_id: zoneId, class: vehicleClass });
    if (p) return toExactPrice(p, 'workshop_service_pricing');
  }

  // Priority 4: Zone only (class null)
  if (zoneId) {
    const p = await tryPrice({ zone_id: zoneId, class: null });
    if (p) return toExactPrice(p, 'workshop_service_pricing');
  }

  // Priority 5: Class only (no city/zone)
  if (vehicleClass) {
    const p = await tryPrice({ class: vehicleClass, city_id: null, zone_id: null });
    if (p) return toExactPrice(p, 'workshop_service_pricing');
  }

  return null;
}

export async function resolvePriceRanges(
  supabase: any,
  input: { ctx: ChatbotContext; suggestions: ServiceSuggestion[] }
): Promise<Record<string, PriceRange | undefined>> {
  const out: Record<string, PriceRange | undefined> = {};

  for (const s of input.suggestions) {
    const key = `${s.kind}:${s.id}`;
    if (s.kind === 'PACKAGE') {
      out[key] = (await getPackagePriceRange(supabase, s.id)) || undefined;
    } else {
      out[key] = (await getServiceTypePriceRange(supabase, input.ctx, s.id)) || undefined;
    }
  }

  return out;
}

export async function resolveExactPrices(
  supabase: any,
  input: { ctx: ChatbotContext; suggestions: ServiceSuggestion[] }
): Promise<Record<string, { currency: 'INR'; amount: number; source: 'workshop_service_pricing' | 'service_packages' | 'fallback' } | undefined>> {
  const out: Record<string, any> = {};

  for (const s of input.suggestions) {
    const key = `${s.kind}:${s.id}`;
    if (s.kind === 'PACKAGE') {
      out[key] = (await getPackageExactPrice(supabase, s.id)) || undefined;
    } else {
      out[key] = (await getServiceTypeExactPrice(supabase, input.ctx, s.id)) || undefined;
    }
  }

  return out;
}
