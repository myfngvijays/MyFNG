import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getWorkshopGeofenceRadiusM,
  loadWorkshopGeofencePoints,
} from '@/lib/workshop-proximity';
import { MAX_WORKSHOP_GEOFENCE_REGIONS } from '@/shared/constants/workshopGeofence';

export const dynamic = 'force-dynamic';

/** Lightweight workshop coordinates for mobile geofence registration. */
export async function GET() {
  try {
    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Database unavailable', workshops: [] }, { status: 500 });
    }

    const [workshops, radiusM] = await Promise.all([
      loadWorkshopGeofencePoints(supabaseAdmin),
      getWorkshopGeofenceRadiusM(supabaseAdmin),
    ]);

    return NextResponse.json({
      success: true,
      radius_m: radiusM,
      max_regions: MAX_WORKSHOP_GEOFENCE_REGIONS,
      count: workshops.length,
      workshops,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load geofences', workshops: [] }, { status: 500 });
  }
}
