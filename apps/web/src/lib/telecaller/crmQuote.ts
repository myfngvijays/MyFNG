import { getServicePrice } from '@/lib/pricing';

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
    couponCode?: string | null;
  },
): Promise<CrmQuoteResult> {
  const serviceTypeIds = (input.serviceTypeIds || []).map(String).filter(Boolean);
  const addonIds = (input.addonIds || []).map(String).filter(Boolean);
  const workshopId = input.workshopId ? String(input.workshopId) : null;
  const cityId = input.cityId ? String(input.cityId) : null;
  const vehicleClass = input.vehicleClass ? String(input.vehicleClass) : null;
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
      if (workshopId) {
        const result = await getServicePrice(supabase, workshopId, st.id, vehicleClass, resolvedZoneId);
        price = Number(result.price || 0);
        source = result.source;
      }
      // Fall back to city/class pricing when workshop price missing
      if (!price) {
        const result = await getCityServicePrice(supabase, st.id, cityId, resolvedZoneId, vehicleClass);
        price = result.price;
        source = result.source;
      }
      // Last resort: any active price row for this service (city-agnostic)
      if (!price) {
        const { data: anyRow } = await supabase
          .from('workshop_service_pricing')
          .select('custom_price')
          .eq('service_type_id', st.id)
          .eq('is_active', true)
          .gt('custom_price', 0)
          .order('custom_price', { ascending: true })
          .limit(1)
          .maybeSingle();
        const p = Number(anyRow?.custom_price || 0);
        if (p > 0) {
          price = p;
          source = 'any_active_tier';
        }
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
      const { data: couponRow } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode)
        .eq('is_active', true)
        .maybeSingle();

      if (couponRow) {
        appliedCoupon = couponCode;
        const mode = String(
          couponRow.discount_mode || couponRow.discount_type || couponRow.type || '',
        ).toUpperCase();
        const value = Number(couponRow.discount_value || couponRow.value || 0);
        const kind = String(couponRow.coupon_kind || '').toUpperCase();
        if (kind === 'FREE_SERVICE') {
          const targetId = String(couponRow.target_service_type_id || '');
          const targetItem = targetId
            ? lineItems.find((i) => i.id === targetId)
            : lineItems.find((i) => i.kind === 'service');
          discount = Number(targetItem?.price || 0);
        } else if (mode.includes('PERCENT') || mode === 'PERCENTAGE') {
          discount = Math.round((subtotal * value) / 100);
        } else {
          discount = value;
        }
        const maxDisc = Number(couponRow.max_discount_amount || couponRow.max_discount || 0);
        if (maxDisc > 0) discount = Math.min(discount, maxDisc);
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
  };
}

export function serviceLabelFromQuote(quote: CrmQuoteResult | null | undefined, fallback = ''): string {
  if (!quote?.line_items?.length) return fallback;
  return quote.line_items
    .map((i) => String(i?.name || '').trim())
    .filter(Boolean)
    .join(', ');
}
