import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { buildTelecallerCrmQuote } from '@/lib/telecaller/crmQuote';

export const dynamic = 'force-dynamic';

async function requireTelecaller(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
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

    const quote = await buildTelecallerCrmQuote(supabase, {
      serviceTypeIds,
      addonIds,
      workshopId,
      cityId,
      zoneId,
      vehicleClass,
      couponCode,
    });

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
      quote,
      workshops,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Quote failed' }, { status: 500 });
  }
}
