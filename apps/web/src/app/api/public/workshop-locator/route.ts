import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { workshopPublicPageAddress, isMyFngBrandedWorkshop } from '@/lib/workshopDisplay';

export const dynamic = 'force-dynamic';

/**
 * GET /api/public/workshop-locator
 * Verified workshops for mobile/web locator with the same display address as workshop public pages.
 */
export async function GET() {
  try {
    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Database not available', workshops: [] }, { status: 500 });
    }

    const [{ data: workshops, error: wsErr }, { data: pages, error: pageErr }] = await Promise.all([
      supabaseAdmin
        .from('workshops')
        .select(
          'id,name,workshop_name,workshop_area,near_famous_area,city,state,address,short_address,landmark,pincode,service_pincode,mapping_pincodes,latitude,longitude,map_link,near_area_google_map,is_verified,phone',
        )
        .eq('is_verified', true)
        .order('created_at', { ascending: false })
        .limit(250),
      supabaseAdmin
        .from('workshop_public_pages')
        .select('workshop_id, gmb_data')
        .eq('is_published', true),
    ]);

    if (wsErr) {
      return NextResponse.json({ error: wsErr.message || 'Failed to load workshops', workshops: [] }, { status: 500 });
    }
    if (pageErr) {
      return NextResponse.json({ error: pageErr.message || 'Failed to load workshop pages', workshops: [] }, { status: 500 });
    }

    const gmbByWorkshop = new Map<string, Record<string, unknown>>();
    for (const page of pages || []) {
      const workshopId = String((page as any)?.workshop_id || '').trim();
      const gmb = (page as any)?.gmb_data;
      if (workshopId && gmb && typeof gmb === 'object') {
        gmbByWorkshop.set(workshopId, gmb as Record<string, unknown>);
      }
    }

    const list = (workshops || [])
      .filter((w: any) => {
        const gmb = gmbByWorkshop.get(String(w.id)) || null;
        return isMyFngBrandedWorkshop({
          name: w.name,
          workshop_name: w.workshop_name,
          gmb_business_name: (gmb as any)?.business_name,
        });
      })
      .map((w: any) => {
        const gmb = gmbByWorkshop.get(String(w.id)) || null;
        const display_address = workshopPublicPageAddress(w, gmb);
        return {
          ...w,
          display_address,
          gmb_formatted_address: String((gmb as any)?.formatted_address || '').trim() || null,
        };
      });

    return NextResponse.json({ success: true, count: list.length, workshops: list });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Workshop locator failed', workshops: [] }, { status: 500 });
  }
}
