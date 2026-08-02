import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import {
  findNearestWorkshopWithinRadius,
  getWorkshopGeofenceRadiusM,
  loadWorkshopGeofencePoints,
  recordWorkshopProximityEvent,
} from '@/lib/workshop-proximity';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));

  const source = body.source === 'foreground' ? 'foreground' : 'geofence';
  const workshopId = String(body.workshop_id || '').trim();
  const latitude = body.latitude != null ? Number(body.latitude) : null;
  const longitude = body.longitude != null ? Number(body.longitude) : null;

  const { data: prefs } = await supabaseAdmin
    .from('customer_notification_preferences')
    .select('workshop_proximity_alerts, push_enabled')
    .eq('customer_id', customer.id)
    .maybeSingle();

  if (!prefs?.workshop_proximity_alerts) {
    return NextResponse.json({ success: true, skipped: 'opt_out' });
  }

  const [workshops, radiusM] = await Promise.all([
    loadWorkshopGeofencePoints(supabaseAdmin),
    getWorkshopGeofenceRadiusM(supabaseAdmin),
  ]);

  let resolvedWorkshopId = workshopId;
  let distanceM: number | null = body.distance_m != null ? Number(body.distance_m) : null;

  if (!resolvedWorkshopId) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: 'workshop_id or coordinates required' }, { status: 400 });
    }
    const nearest = findNearestWorkshopWithinRadius(workshops, latitude as number, longitude as number, radiusM);
    if (!nearest) return NextResponse.json({ success: true, skipped: 'outside_radius' });
    resolvedWorkshopId = nearest.workshop.id;
    distanceM = nearest.distanceM;
  }

  const result = await recordWorkshopProximityEvent(supabaseAdmin, {
    customer: {
      id: customer.id,
      phone: customer.phone,
      full_name: customer.full_name,
    },
    workshopId: resolvedWorkshopId,
    source,
    latitude,
    longitude,
    distanceM,
  });

  return NextResponse.json({ success: true, ...result });
}
