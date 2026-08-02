import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { filterWorkshopsForPincode } from '@/lib/whatsappBotFlow/workshopPincode';
import { workshopPublicPageAddress, isMyFngBrandedWorkshop } from '@/lib/workshopDisplay';

export const dynamic = 'force-dynamic';

/**
 * GET /api/telecaller/crm/workshops?pincode=400607&city=Thane
 * Nearby / covering workshops for visit booking.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(supabase, user);
    const roleCode = String((profile as any)?.roles?.role_code || '');
    if (!['TELECALLER', 'SUPER_ADMIN', 'SUB_ADMIN', 'RSA_MANAGER', 'LEAD_MANAGER'].includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const pincode = String(url.searchParams.get('pincode') || '').trim();
    const city = String(url.searchParams.get('city') || '').trim();

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;

    const { data: rows, error } = await db
      .from('workshops')
      .select(
        'id, name, workshop_name, workshop_area, near_famous_area, city, state, address, short_address, landmark, pincode, service_pincode, mapping_pincodes, phone, is_verified, audit_score, one_day_capacity, latitude, longitude',
      )
      .eq('is_verified', true)
      .order('audit_score', { ascending: false, nullsFirst: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to load workshops' }, { status: 400 });
    }

    let list = (Array.isArray(rows) ? rows : []).filter((w: any) =>
      isMyFngBrandedWorkshop({
        name: w.name,
        workshop_name: w.workshop_name,
      }),
    );

    const workshopIds = list.map((w: any) => String(w.id || '').trim()).filter(Boolean);
    const gmbByWorkshop = new Map<string, Record<string, unknown>>();
    if (workshopIds.length > 0) {
      const { data: pageRows } = await db
        .from('workshop_public_pages')
        .select('workshop_id, gmb_data')
        .eq('is_published', true)
        .in('workshop_id', workshopIds);
      for (const page of pageRows || []) {
        const workshopId = String((page as any)?.workshop_id || '').trim();
        const gmb = (page as any)?.gmb_data;
        if (workshopId && gmb && typeof gmb === 'object') {
          gmbByWorkshop.set(workshopId, gmb as Record<string, unknown>);
        }
      }
    }

    if (/^\d{6}$/.test(pincode)) {
      const nearby = filterWorkshopsForPincode(list, pincode);
      if (nearby.length > 0) {
        list = nearby;
      } else if (city) {
        list = list
          .filter((w: any) => String(w.city || '').toLowerCase().includes(city.toLowerCase()))
          .slice(0, 40);
      } else {
        list = [];
      }
    } else if (city) {
      list = list
        .filter((w: any) => String(w.city || '').toLowerCase().includes(city.toLowerCase()))
        .slice(0, 40);
    } else {
      list = list.slice(0, 40);
    }

    const workshops = list.map((w: any) => {
      const areaLabel =
        String(w.workshop_name || '').trim() ||
        String(w.workshop_area || '').trim() ||
        String(w.near_famous_area || '').trim() ||
        null;
      const serviceCenter = String(w.name || '').trim() || null;
      const gmb = gmbByWorkshop.get(String(w.id)) || null;
      const address = workshopPublicPageAddress(w, gmb);
      return {
        id: w.id,
        /** MyFNG area brand name e.g. MyFNG Majiwada */
        workshop_name: areaLabel,
        /** Real service center / garage name */
        service_center_name: serviceCenter,
        name: areaLabel || serviceCenter || 'Workshop',
        workshop_area: w.workshop_area || null,
        near_famous_area: w.near_famous_area || null,
        city: w.city,
        address,
        short_address: w.short_address || null,
        landmark: w.landmark || null,
        pincode: w.pincode,
        phone: w.phone,
        is_verified: w.is_verified,
        audit_score: w.audit_score,
        one_day_capacity: w.one_day_capacity,
        latitude: w.latitude,
        longitude: w.longitude,
      };
    });

    return NextResponse.json({
      success: true,
      pincode: pincode || null,
      count: workshops.length,
      workshops,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Workshops lookup failed' }, { status: 500 });
  }
}
