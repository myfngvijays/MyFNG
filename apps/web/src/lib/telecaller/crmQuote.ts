import { getServicePrice } from '@/lib/pricing';
import { applyMaxDiscountCap } from '@/lib/coupon-rules';

export type CrmQuoteLineItem = {
  kind: 'service' | 'addon';
  id: string;
  name: string;
  price: number;
  source: string;
};

export type CrmQuoteResult = {
  line_items: CrmQuoteLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  coupon_code: string | null;
  currency: 'INR';
  /** Class used for this quote. Filled from car_models when the lead only has make/model text. */
  vehicle_class: string | null;
  model_id: string | null;
};

/** City / zone / class pricing when workshop is not selected. */
export async function getCityServicePrice(
  supabase: any,
  serviceTypeId: string,
  cityId: string | null,
  zoneId: string | null,
  vehicleClass: string | null,
): Promise<{ price: number; source: string }> {
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
    const p = Number(data?.custom_price || 0);
    return Number.isFinite(p) && p > 0 ? p : 0;
  };

  if (cityId && vehicleClass) {
    const p = await tryPrice({ city_id: cityId, class: vehicleClass });
    if (p) return { price: p, source: 'city_class' };
  }
  if (cityId) {
    const p = await tryPrice({ city_id: cityId, class: null });
    if (p) return { price: p, source: 'city' };
  }
  if (zoneId && vehicleClass) {
    const p = await tryPrice({ zone_id: zoneId, class: vehicleClass });
    if (p) return { price: p, source: 'zone_class' };
  }
  if (zoneId) {
    const p = await tryPrice({ zone_id: zoneId, class: null });
    if (p) return { price: p, source: 'zone' };
  }
  if (vehicleClass) {
    const p = await tryPrice({ class: vehicleClass, city_id: null, zone_id: null });
    if (p) return { price: p, source: 'class' };
  }
  return { price: 0, source: 'master_default' };
}

export function parseServiceIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v || '').trim()).filter(Boolean);
      }
    } catch {
      return raw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function cleanIlikeToken(value: string): string {
  return value.replace(/[%_\\]/g, '').trim();
}

/**
 * Leads imported from TeleCRM often have "SKODA" + "RAPID" text and no model_id.
 * Without a class, workshop prices cannot match and must not fall through to another city's rate.
 */
export async function resolveCarForQuote(
  supabase: any,
  input: {
    vehicleClass?: string | null;
    modelId?: string | null;
    vehicleMake?: string | null;
    vehicleModel?: string | null;
  },
): Promise<{ vehicleClass: string | null; modelId: string | null }> {
  const givenClass = String(input.vehicleClass || '').trim() || null;
  const givenModelId = String(input.modelId || '').trim() || null;
  if (givenClass) return { vehicleClass: givenClass, modelId: givenModelId };

  if (givenModelId) {
    try {
      const { data } = await supabase
        .from('car_models')
        .select('id, class')
        .eq('id', givenModelId)
        .maybeSingle();
      const cls = String(data?.class || '').trim() || null;
      if (cls) return { vehicleClass: cls, modelId: String(data?.id || givenModelId) };
    } catch {
      // try make + model next
    }
  }

  const makeToken = cleanIlikeToken(String(input.vehicleMake || '').split(/\s+/)[0] || '');
  const modelRaw = String(input.vehicleModel || '').trim();
  const modelToken = cleanIlikeToken(modelRaw.split(/\s+/)[0] || '');
  if (!makeToken || !modelToken) return { vehicleClass: null, modelId: givenModelId };

  try {
    const { data } = await supabase
      .from('car_models')
      .select('id, class, model_name')
      .eq('is_active', true)
      .ilike('make', `%${makeToken}%`)
      .ilike('model_name', `%${modelToken}%`)
      .order('model_name')
      .limit(20);
    const rows = (data || []) as Array<{ id?: string; class?: string; model_name?: string }>;
    const wanted = modelRaw.toLowerCase();
    const token = modelToken.toLowerCase();
    const exact = rows.filter((row) => {
      const name = String(row.model_name || '').trim().toLowerCase();
      return name === wanted || name === token;
    });
    const pool = exact.length ? exact : rows;
    const classes = [...new Set(pool.map((row) => String(row.class || '').trim()).filter(Boolean))];
    if (classes.length !== 1) return { vehicleClass: null, modelId: givenModelId };
    return {
      vehicleClass: classes[0],
      modelId: String(pool[0]?.id || givenModelId || '') || null,
    };
  } catch {
    return { vehicleClass: null, modelId: givenModelId };
  }
}

export async function resolveServiceTypeNames(supabase: any, ids: string[]): Promise<string> {
  if (!ids.length) return '';
  const { data } = await supabase.from('service_types').select('id, name').in('id', ids);
  const byId = new Map((data || []).map((row: any) => [String(row.id), String(row.name || '').trim()]));
  return ids.map((id) => byId.get(id) || '').filter(Boolean).join(', ');
}

/**
 * Build live price quote for telecaller CRM booking / lead update.
 */
export async function buildTelecallerCrmQuote(
  supabase: any,
  input: {
    serviceTypeIds?: string[];
    addonIds?: string[];
    workshopId?: string | null;
    cityId?: string | null;
    zoneId?: string | null;
    vehicleClass?: string | null;
    modelId?: string | null;
    vehicleMake?: string | null;
    vehicleModel?: string | null;
    couponCode?: string | null;
  },
): Promise<CrmQuoteResult> {
  const serviceTypeIds = (input.serviceTypeIds || []).map(String).filter(Boolean);
  const addonIds = (input.addonIds || []).map(String).filter(Boolean);
  const workshopId = input.workshopId ? String(input.workshopId) : null;
  const cityId = input.cityId ? String(input.cityId) : null;
  const car = await resolveCarForQuote(supabase, {
    vehicleClass: input.vehicleClass,
    modelId: input.modelId,
    vehicleMake: input.vehicleMake,
    vehicleModel: input.vehicleModel,
  });
  const vehicleClass = car.vehicleClass;
  const couponCode = String(input.couponCode || '')
    .trim()
    .toUpperCase();

  let resolvedZoneId = input.zoneId ? String(input.zoneId) : null;
  if (!resolvedZoneId && cityId) {
    const { data: cityRow } = await supabase.from('cities').select('zone_id').eq('id', cityId).maybeSingle();
    resolvedZoneId = cityRow?.zone_id ? String(cityRow.zone_id) : null;
  }

  const lineItems: CrmQuoteLineItem[] = [];

  if (serviceTypeIds.length > 0) {
    const { data: types } = await supabase.from('service_types').select('id, name').in('id', serviceTypeIds);
    for (const st of types || []) {
      let price = 0;
      let source = 'master_default';
      // Workshop rows are stored per class (and zone). Match that class directly.
      // Never pick the cheapest row in the table — that sent Urban hatchback ₹8,635
      // for a Mumbai sedan whose real price was ₹9,955.
      if (workshopId && vehicleClass) {
        const { data: workshopRows } = await supabase
          .from('workshop_service_pricing')
          .select('custom_price, zone_id')
          .eq('workshop_id', workshopId)
          .eq('service_type_id', st.id)
          .eq('class', vehicleClass)
          .eq('is_active', true)
          .gt('custom_price', 0);
        const rows = (workshopRows || []) as Array<{ custom_price?: number; zone_id?: string | null }>;
        const zoned = resolvedZoneId
          ? rows.find((row) => String(row.zone_id || '') === resolvedZoneId)
          : null;
        const picked = zoned || rows.find((row) => !row.zone_id) || rows[0];
        const workshopPrice = Number(picked?.custom_price || 0);
        if (workshopPrice > 0) {
          price = workshopPrice;
          source = zoned ? 'workshop_class_zone' : 'workshop_class';
        }
      }
      if (!price && workshopId) {
        const result = await getServicePrice(supabase, workshopId, st.id, vehicleClass, resolvedZoneId);
        price = Number(result.price || 0);
        source = result.source;
      }
      // City / zone + class when this workshop has no row for the car's class.
      if (!price) {
        const result = await getCityServicePrice(supabase, st.id, cityId, resolvedZoneId, vehicleClass);
        price = result.price;
        source = result.source;
      }
      lineItems.push({
        kind: 'service',
        id: st.id,
        name: st.name,
        price,
        source,
      });
    }
  }

  if (addonIds.length > 0) {
    const { data: addons } = await supabase.from('service_addons').select('id, name, price').in('id', addonIds);
    for (const ad of addons || []) {
      lineItems.push({
        kind: 'addon',
        id: ad.id,
        name: ad.name,
        price: Number(ad.price || 0),
        source: 'addon_fixed',
      });
    }
  }

  const subtotal = lineItems.reduce((sum, i) => sum + Number(i.price || 0), 0);
  let discount = 0;
  let appliedCoupon: string | null = null;

  if (couponCode) {
    try {
        const couponPattern = couponCode.replace(/[%_\\]/g, (ch) => `\\${ch}`);
        const { data: couponRow } = await supabase
        .from('coupons')
        .select('*')
        .ilike('code', couponPattern)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (couponRow) {
        appliedCoupon = couponCode;
        const mode = String(
          couponRow.discount_mode || couponRow.discount_type || couponRow.type || '',
        ).toUpperCase();
        const value = Number(couponRow.discount_value || couponRow.value || 0);
        const kind = String(couponRow.coupon_kind || '').toUpperCase();
        const minOrder = Number(couponRow.min_order_value || couponRow.min_amount || 0);
        const meetsMinimum = !(minOrder > 0 && subtotal < minOrder);
        if (meetsMinimum && kind === 'FREE_SERVICE') {
          const targetId = String(couponRow.target_service_type_id || '');
          const targetItem = targetId
            ? lineItems.find((i) => i.id === targetId)
            : lineItems.find((i) => i.kind === 'service');
          discount = Number(targetItem?.price || 0);
        } else if (meetsMinimum && (mode.includes('PERCENT') || mode === 'PERCENTAGE')) {
          const payable = Math.round((subtotal * (100 - value)) / 100);
          discount = Math.max(0, subtotal - payable);
          discount = applyMaxDiscountCap(discount, couponRow, vehicleClass);
        } else if (meetsMinimum) {
          discount = value;
        }
        if (!meetsMinimum) appliedCoupon = null;
        discount = Math.min(discount, subtotal);
      }
    } catch {
      // coupon optional
    }
  }

  return {
    line_items: lineItems,
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
    coupon_code: appliedCoupon,
    currency: 'INR',
    vehicle_class: vehicleClass,
    model_id: car.modelId,
  };
}

export function serviceLabelFromQuote(quote: CrmQuoteResult | null | undefined, fallback = ''): string {
  if (!quote?.line_items?.length) return fallback;
  return quote.line_items
    .map((i) => String(i?.name || '').trim())
    .filter(Boolean)
    .join(', ');
}
