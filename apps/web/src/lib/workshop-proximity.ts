import {
  DEFAULT_WORKSHOP_GEOFENCE_RADIUS_M,
  MAX_WORKSHOP_GEOFENCE_RADIUS_M,
  MIN_WORKSHOP_GEOFENCE_RADIUS_M,
  WORKSHOP_PROXIMITY_DEDUP_HOURS,
} from '@/shared/constants/workshopGeofence';
import { dispatchPushToCustomer } from '@/lib/push/dispatchCustomerPush';
import { notifyWorkshopProximityWhatsApp } from '@/lib/services/workshopProximityWhatsApp';
import { isMyFngBrandedWorkshop } from '@/lib/workshopDisplay';

export type WorkshopGeofencePoint = {
  id: string;
  name: string;
  city: string | null;
  latitude: number;
  longitude: number;
};

const TERMINAL_LEAD_STATUSES = new Set([
  'COMPLETED',
  'DELIVERED',
  'CLOSED',
  'CANCELLED',
  'REJECTED',
  'LOST',
  'DUPLICATE',
]);

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export async function getWorkshopGeofenceRadiusM(supabaseAdmin: any): Promise<number> {
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'workshop_geofence_radius_m')
    .maybeSingle();

  const n = Number(data?.setting_value);
  if (Number.isFinite(n) && n >= MIN_WORKSHOP_GEOFENCE_RADIUS_M && n <= MAX_WORKSHOP_GEOFENCE_RADIUS_M) {
    return Math.round(n);
  }
  return DEFAULT_WORKSHOP_GEOFENCE_RADIUS_M;
}

export async function loadWorkshopGeofencePoints(supabaseAdmin: any): Promise<WorkshopGeofencePoint[]> {
  const { data: workshops } = await supabaseAdmin
    .from('workshops')
    .select('id, name, workshop_name, city, latitude, longitude, is_verified')
    .eq('is_verified', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(300);

  const { data: pages } = await supabaseAdmin
    .from('workshop_public_pages')
    .select('workshop_id, gmb_data')
    .eq('is_published', true);

  const gmbByWorkshop = new Map<string, Record<string, unknown>>();
  for (const page of pages || []) {
    const workshopId = String((page as any)?.workshop_id || '').trim();
    const gmb = (page as any)?.gmb_data;
    if (workshopId && gmb && typeof gmb === 'object') {
      gmbByWorkshop.set(workshopId, gmb as Record<string, unknown>);
    }
  }

  return (workshops || [])
    .filter((w: any) => {
      const lat = Number(w.latitude);
      const lng = Number(w.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      const gmb = gmbByWorkshop.get(String(w.id)) || null;
      return isMyFngBrandedWorkshop({
        name: w.name,
        workshop_name: w.workshop_name,
        gmb_business_name: (gmb as any)?.business_name,
      });
    })
    .map((w: any) => ({
      id: String(w.id),
      name: String(w.workshop_name || w.name || 'MyFNG Workshop'),
      city: w.city ? String(w.city) : null,
      latitude: Number(w.latitude),
      longitude: Number(w.longitude),
    }));
}

export function findNearestWorkshopWithinRadius(
  workshops: WorkshopGeofencePoint[],
  latitude: number,
  longitude: number,
  radiusM: number,
): { workshop: WorkshopGeofencePoint; distanceM: number } | null {
  let best: { workshop: WorkshopGeofencePoint; distanceM: number } | null = null;

  for (const workshop of workshops) {
    const distanceM = haversineDistanceMeters(latitude, longitude, workshop.latitude, workshop.longitude);
    if (distanceM > radiusM) continue;
    if (!best || distanceM < best.distanceM) {
      best = { workshop, distanceM };
    }
  }

  return best;
}

export function pickGeofenceWorkshops(
  workshops: WorkshopGeofencePoint[],
  latitude: number,
  longitude: number,
  maxRegions: number,
): WorkshopGeofencePoint[] {
  return [...workshops]
    .map((workshop) => ({
      workshop,
      distanceM: haversineDistanceMeters(latitude, longitude, workshop.latitude, workshop.longitude),
    }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, maxRegions)
    .map((item) => item.workshop);
}

async function customerHasActiveBooking(supabaseAdmin: any, customerPhone: string): Promise<boolean> {
  const phone = String(customerPhone || '').replace(/\D/g, '').slice(-10);
  if (!phone) return false;

  const { data: leads } = await supabaseAdmin
    .from('service_leads')
    .select('id, status')
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false })
    .limit(20);

  return (leads || []).some((lead: any) => {
    const status = String(lead.status || '').toUpperCase();
    return status && !TERMINAL_LEAD_STATUSES.has(status);
  });
}

async function wasRecentlyLogged(
  supabaseAdmin: any,
  customerId: string,
  workshopId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - WORKSHOP_PROXIMITY_DEDUP_HOURS * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from('workshop_proximity_events')
    .select('id')
    .eq('customer_id', customerId)
    .eq('workshop_id', workshopId)
    .gte('created_at', since)
    .limit(1);

  return Boolean(data?.length);
}

export async function recordWorkshopProximityEvent(
  supabaseAdmin: any,
  input: {
    customer: { id: string; phone: string; full_name?: string | null };
    workshopId: string;
    source: 'geofence' | 'foreground';
    latitude?: number | null;
    longitude?: number | null;
    distanceM?: number | null;
  },
): Promise<{
  logged: boolean;
  skipped?: string;
  eventId?: string;
  hadActiveBooking?: boolean;
  opsAlertSent?: boolean;
  customerNudgeSent?: boolean;
}> {
  const customerId = String(input.customer.id || '').trim();
  const workshopId = String(input.workshopId || '').trim();
  if (!customerId || !workshopId) return { logged: false, skipped: 'missing_ids' };

  if (await wasRecentlyLogged(supabaseAdmin, customerId, workshopId)) {
    return { logged: false, skipped: 'deduped' };
  }

  const hadActiveBooking = await customerHasActiveBooking(supabaseAdmin, input.customer.phone);

  const { data: workshop } = await supabaseAdmin
    .from('workshops')
    .select('id, name, workshop_name, city')
    .eq('id', workshopId)
    .maybeSingle();

  if (!workshop) return { logged: false, skipped: 'workshop_not_found' };

  const workshopName = String(workshop.workshop_name || workshop.name || 'MyFNG Workshop');

  let opsAlertSent = false;
  let customerNudgeSent = false;
  let customerWhatsAppSent = false;

  if (!hadActiveBooking) {
    try {
      const push = await dispatchPushToCustomer(
        customerId,
        {
          title: 'Near a MyFNG service center?',
          body: `You're close to ${workshopName}. Book via the app for wallet benefits, tracking & warranty.`,
          notificationType: 'WORKSHOP_PROXIMITY',
          data: {
            screen: 'Book Service',
            workshop_id: workshopId,
          },
        },
        'offers',
      );
      customerNudgeSent = push.delivered > 0;
    } catch (err) {
      console.warn('[workshop-proximity] customer nudge failed:', err);
    }

    try {
      const wa = await notifyWorkshopProximityWhatsApp({
        customerId,
        phone: input.customer.phone,
        customerName: input.customer.full_name,
        workshopName,
        workshopId,
      });
      customerWhatsAppSent = wa.sent;
    } catch (err) {
      console.warn('[workshop-proximity] customer whatsapp failed:', err);
    }

    opsAlertSent = true;
  }

  const { data: event, error } = await supabaseAdmin
    .from('workshop_proximity_events')
    .insert({
      customer_id: customerId,
      workshop_id: workshopId,
      event_type: 'enter',
      source: input.source,
      distance_m: input.distanceM != null ? Number(input.distanceM) : null,
      latitude: input.latitude != null ? Number(input.latitude) : null,
      longitude: input.longitude != null ? Number(input.longitude) : null,
      had_active_booking: hadActiveBooking,
      ops_alert_sent: opsAlertSent && !hadActiveBooking,
      customer_nudge_sent: customerNudgeSent,
      metadata: {
        workshop_name: workshopName,
        workshop_city: workshop.city || null,
        customer_phone_last10: String(input.customer.phone || '').replace(/\D/g, '').slice(-10),
        customer_whatsapp_sent: customerWhatsAppSent,
      },
    })
    .select('id')
    .single();

  if (error || !event) {
    console.warn('[workshop-proximity] insert failed:', error?.message || error);
    return { logged: false, skipped: 'insert_failed' };
  }

  await supabaseAdmin.from('customer_analytics_events').insert({
    customer_id: customerId,
    event_name: 'workshop_proximity_enter',
    event_group: 'location',
    properties: {
      workshop_id: workshopId,
      workshop_name: workshopName,
      source: input.source,
      had_active_booking: hadActiveBooking,
      distance_m: input.distanceM ?? null,
    },
  });

  return {
    logged: true,
    eventId: event.id,
    hadActiveBooking,
    opsAlertSent: opsAlertSent && !hadActiveBooking,
    customerNudgeSent,
  };
}
