import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getServicePrice } from '@/lib/pricing';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

/** City / zone / class pricing when workshop is not selected (same priority as customer booking). */
async function getCityServicePrice(
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

async function requireTelecaller(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const profile = await resolveUserProfile(supabase, user);
  const roleCode = String((profile as any)?.roles?.role_code || '');
  if (!['TELECALLER', 'SUPER_ADMIN', 'SUB_ADMIN', 'RSA_MANAGER'].includes(roleCode)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { supabase, user, profile, roleCode };
}

/**
 * POST /api/telecaller/crm/quote
 * Live price quote for telecaller booking (workshop pricing + addons + optional coupon).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireTelecaller(request);
    if ('error' in auth && auth.error) return auth.error;
    const { supabase } = auth as any;

    const body = await request.json().catch(() => ({}));
    const workshopId = String(body?.workshop_id || '').trim() || null;
    const vehicleClass = body?.vehicle_class ? String(body.vehicle_class) : null;
    const zoneId = body?.zone_id ? String(body.zone_id) : null;
    const serviceTypeIds: string[] = Array.isArray(body?.service_type_ids)
      ? body.service_type_ids.map(String)
      : [];
    const addonIds: string[] = Array.isArray(body?.addon_ids) ? body.addon_ids.map(String) : [];
    const couponCode = String(body?.coupon_code || '').trim().toUpperCase();
    const cityId = body?.city_id ? String(body.city_id) : null;

    let resolvedZoneId = zoneId;
    if (!resolvedZoneId && cityId) {
      const { data: cityRow } = await supabase.from('cities').select('zone_id').eq('id', cityId).maybeSingle();
      resolvedZoneId = cityRow?.zone_id ? String(cityRow.zone_id) : null;
    }

    const lineItems: Array<{
      kind: 'service' | 'addon';
      id: string;
      name: string;
      price: number;
      source: string;
    }> = [];

    // Services: workshop pricing when selected, else city/class pricing
    if (serviceTypeIds.length > 0) {
      const { data: types } = await supabase
        .from('service_types')
        .select('id, name')
        .in('id', serviceTypeIds);

      for (const st of types || []) {
        let price = 0;
        let source = 'master_default';
        if (workshopId) {
          const result = await getServicePrice(supabase, workshopId, st.id, vehicleClass, resolvedZoneId);
          price = Number(result.price || 0);
          source = result.source;
        } else {
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

    // Addons use fixed price from service_addons
    if (addonIds.length > 0) {
      const { data: addons } = await supabase
        .from('service_addons')
        .select('id, name, price')
        .in('id', addonIds);
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
    let coupon: any = null;

    if (couponCode) {
      try {
        const { data: couponRow } = await supabase
          .from('coupons')
          .select('*')
          .eq('code', couponCode)
          .eq('is_active', true)
          .maybeSingle();

        if (couponRow) {
          coupon = couponRow;
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

    // Suggested workshops for city
    let workshops: any[] = [];
    if (cityId || body?.city) {
      let q = supabase
        .from('workshops')
        .select('id, name, city, phone, address, audit_score, one_day_capacity, is_verified')
        .eq('is_verified', true)
        .order('audit_score', { ascending: false, nullsFirst: false })
        .limit(30);
      if (body?.city) q = q.ilike('city', `%${String(body.city)}%`);
      const { data } = await q;
      workshops = data || [];

      // Attach active lead load
      if (workshops.length > 0) {
        const ids = workshops.map((w) => w.id);
        const { data: active } = await supabase
          .from('service_leads')
          .select('workshop_id')
          .in('workshop_id', ids)
          .not('status', 'in', '("COMPLETED","CLOSED","CANCELLED","REJECTED","DELIVERED")');
        const counts: Record<string, number> = {};
        (active || []).forEach((r: any) => {
          const id = String(r.workshop_id);
          counts[id] = (counts[id] || 0) + 1;
        });
        workshops = workshops.map((w) => {
          const load = counts[w.id] || 0;
          const cap = Number(w.one_day_capacity || 10);
          let capacity_status = 'AVAILABLE';
          if (load >= cap) capacity_status = 'FULL';
          else if (load >= Math.max(1, Math.floor(cap * 0.7))) capacity_status = 'BUSY';
          return { ...w, active_leads: load, capacity_status };
        });
      }
    }

    return NextResponse.json({
      success: true,
      quote: {
        line_items: lineItems,
        subtotal,
        discount,
        total: Math.max(0, subtotal - discount),
        coupon_code: coupon ? couponCode : null,
        currency: 'INR',
      },
      workshops,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Quote failed' }, { status: 500 });
  }
}
