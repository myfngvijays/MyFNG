import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { dispatchPushToUser } from '@/lib/push/dispatchPush';
import type { NotificationType, NotificationPriority } from '@/shared/types/notifications';

export const dynamic = 'force-dynamic';

type LocationMode = 'PICKUP' | 'WORKSHOP' | 'DROP';

function toNum(v: any): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371; // km
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

async function recentlyNotified(params: {
  supabaseAdmin: any;
  userId: string;
  leadId: string;
  type: NotificationType;
  windowMinutes: number;
}) {
  const { supabaseAdmin, userId, leadId, type, windowMinutes } = params;
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('lead_id', leadId)
    .eq('type', type)
    .gte('created_at', since)
    .limit(1);
  return !!(data && data.length > 0);
}

async function createNotificationAdmin(params: {
  supabaseAdmin: any;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  leadId: string;
  leadNumber?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}) {
  const { supabaseAdmin, userId, type, title, message, priority, leadId, leadNumber, actionUrl, metadata } = params;
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      priority,
      lead_id: leadId,
      lead_number: leadNumber,
      action_url: actionUrl,
      metadata,
      is_read: false,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  if (data?.id) void dispatchPushToUser(userId, data as any);
  return data;
}

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const params = await paramsPromise;
    const supabase = await createClientFromRequest(request);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const leadId = params.id;
    const body = await request.json().catch(() => ({}));

    const latitude = toNum(body?.latitude);
    const longitude = toNum(body?.longitude);
    const accuracy = toNum(body?.accuracy);
    const speed = toNum(body?.speed);
    const heading = toNum(body?.heading);
    const batteryLevel = toNum(body?.battery_level);
    const mode = String(body?.mode || 'PICKUP').toUpperCase() as LocationMode;

    if (latitude == null || longitude == null) {
      return NextResponse.json({ error: 'latitude and longitude are required' }, { status: 400 });
    }
    if (!['PICKUP', 'WORKSHOP', 'DROP'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode', valid: ['PICKUP', 'WORKSHOP', 'DROP'] }, { status: 400 });
    }

    // Verify role + assignment
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', auth.user.id)
      .single();
    if (profileError || !userProfile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_PICKUP_BOY') {
      return NextResponse.json({ error: 'Forbidden: Pickup Boy only' }, { status: 403 });
    }

    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, lead_number, workshop_id, assigned_pickup_boy_id, customer_lat, customer_lng, pickup_latitude, pickup_longitude')
      .eq('id', leadId)
      .single();
    if (leadError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const { data: tracking, error: trackingError } = await supabase
      .from('pickup_tracking')
      .select(
        'pickup_assigned_to, drop_assigned_to, pickup_status, drop_status, pickup_latitude, pickup_longitude, drop_latitude, drop_longitude'
      )
      .eq('lead_id', leadId)
      .maybeSingle();
    if (trackingError) return NextResponse.json({ error: 'Failed to load tracking' }, { status: 500 });

    const isAssigned =
      (lead as any).assigned_pickup_boy_id === userProfile.id ||
      (tracking as any)?.pickup_assigned_to === userProfile.id ||
      (tracking as any)?.drop_assigned_to === userProfile.id;
    if (!isAssigned) return NextResponse.json({ error: 'Not assigned to this lead' }, { status: 403 });

    const status =
      mode === 'PICKUP'
        ? 'MOVING_TO_PICKUP'
        : mode === 'WORKSHOP'
          ? 'IN_TRANSIT_TO_WORKSHOP'
          : 'MOVING_TO_DROP';

    // Store the ping (best-effort; RLS should allow pickup boy to insert their own rows)
    await supabase.from('pickup_location_tracking').insert({
      lead_id: leadId,
      pickup_boy_id: userProfile.id,
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      status,
      battery_level: batteryLevel == null ? null : Math.round(batteryLevel),
      timestamp: new Date().toISOString(),
    } as any);

    // Deviation/delay detection + admin alerts requires service role to reliably notify other users.
    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ success: true, recorded: true, admin_alerts: false, hint: adminError }, { status: 200 });
    }

    // Destination coords
    let destLat: number | null = null;
    let destLng: number | null = null;
    if (mode === 'PICKUP') {
      destLat = toNum((tracking as any)?.pickup_latitude) ?? toNum((lead as any)?.pickup_latitude) ?? toNum((lead as any)?.customer_lat);
      destLng = toNum((tracking as any)?.pickup_longitude) ?? toNum((lead as any)?.pickup_longitude) ?? toNum((lead as any)?.customer_lng);
    } else if (mode === 'DROP') {
      destLat = toNum((tracking as any)?.drop_latitude) ?? toNum((lead as any)?.customer_lat);
      destLng = toNum((tracking as any)?.drop_longitude) ?? toNum((lead as any)?.customer_lng);
    } else {
      // WORKSHOP
      if ((lead as any)?.workshop_id) {
        const { data: ws } = await supabaseAdmin
          .from('workshops')
          .select('latitude, longitude')
          .eq('id', (lead as any).workshop_id)
          .maybeSingle();
        destLat = toNum((ws as any)?.latitude);
        destLng = toNum((ws as any)?.longitude);
      }
    }

    const leadNumber = (lead as any)?.lead_number || leadId;

    // Pull recent pings for trend
    const { data: recent } = await supabaseAdmin
      .from('pickup_location_tracking')
      .select('latitude, longitude, timestamp, status')
      .eq('lead_id', leadId)
      .eq('pickup_boy_id', userProfile.id)
      .eq('status', status)
      .order('timestamp', { ascending: false })
      .limit(6);

    const points = (recent || [])
      .map((r: any) => ({
        lat: toNum(r.latitude),
        lng: toNum(r.longitude),
        ts: r.timestamp ? new Date(r.timestamp).getTime() : null,
      }))
      .filter((p: any) => p.lat != null && p.lng != null && p.ts != null) as Array<{ lat: number; lng: number; ts: number }>;

    let distanceKm: number | null = null;
    if (destLat != null && destLng != null) {
      distanceKm = haversineKm(latitude, longitude, destLat, destLng);
    }

    // Delay: last ping gap too large while in moving status (server-side best-effort)
    let delayDetected = false;
    if (points.length >= 2) {
      const newest = points[0];
      const prev = points[1];
      const gapMin = (newest.ts - prev.ts) / (60 * 1000);
      if (gapMin >= 7) delayDetected = true;
    }

    // Deviation: distance-to-destination is increasing over several pings
    let deviationDetected = false;
    if (destLat != null && destLng != null && points.length >= 4) {
      const ds = points
        .slice(0, 4)
        .map((p) => haversineKm(p.lat, p.lng, destLat!, destLng!))
        .reverse(); // oldest -> newest
      const deltas = [ds[1] - ds[0], ds[2] - ds[1], ds[3] - ds[2]];
      const incCount = deltas.filter((d) => d > 0.2).length;
      const totalInc = ds[3] - ds[0];
      if (incCount >= 2 && totalInc > 0.6) deviationDetected = true;
    }

    // Alert recipients (workshop admin/supervisor) if we have a workshop
    let adminAlerted = false;
    const workshopId = (lead as any)?.workshop_id;
    let adminUserIds: string[] = [];
    if (workshopId) {
      const { data: roles } = await supabaseAdmin
        .from('roles')
        .select('id, role_code')
        .in('role_code', ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR']);
      const roleIds = (roles || []).map((r: any) => r.id).filter(Boolean);
      if (roleIds.length > 0) {
        const { data: users } = await supabaseAdmin
          .from('users_login')
          .select('id')
          .eq('workshop_id', workshopId)
          .in('role_id', roleIds)
          .eq('is_active', true);
        adminUserIds = (users || []).map((u: any) => u.id).filter(Boolean);
      }
    }

    const actionUrlAdmin = `/dashboard/workshop-advisor/pickup-delivery`;
    const actionUrlPickupBoy = `/dashboard/workshop_pickup_boy/tasks/${leadId}`;

    if (deviationDetected) {
      const type: NotificationType = 'ROUTE_DEVIATION';
      const already = await recentlyNotified({ supabaseAdmin, userId: userProfile.id, leadId, type, windowMinutes: 10 });
      if (!already) {
        await createNotificationAdmin({
          supabaseAdmin,
          userId: userProfile.id,
          type,
          title: 'Route deviation detected',
          message: `Lead ${leadNumber}: You are moving away from the destination. Please correct route or inform admin.`,
          priority: 'URGENT',
          leadId,
          leadNumber,
          actionUrl: actionUrlPickupBoy,
          metadata: { kind: 'ROUTE_DEVIATION', mode, distance_km: distanceKm },
        });
      }

      for (const adminId of adminUserIds) {
        const alreadyAdmin = await recentlyNotified({ supabaseAdmin, userId: adminId, leadId, type, windowMinutes: 10 });
        if (alreadyAdmin) continue;
        await createNotificationAdmin({
          supabaseAdmin,
          userId: adminId,
          type,
          title: 'Pickup boy route deviation',
          message: `Lead ${leadNumber}: Route deviation detected for pickup/delivery.`,
          priority: 'HIGH',
          leadId,
          leadNumber,
          actionUrl: actionUrlAdmin,
          metadata: { kind: 'ROUTE_DEVIATION', mode, pickup_boy_id: userProfile.id, distance_km: distanceKm },
        });
        adminAlerted = true;
      }
    }

    if (!deviationDetected && delayDetected) {
      const type: NotificationType = 'ROUTE_DELAY';
      const already = await recentlyNotified({ supabaseAdmin, userId: userProfile.id, leadId, type, windowMinutes: 10 });
      if (!already) {
        await createNotificationAdmin({
          supabaseAdmin,
          userId: userProfile.id,
          type,
          title: 'Route delay detected',
          message: `Lead ${leadNumber}: No location updates for a while. Please continue movement or inform admin.`,
          priority: 'HIGH',
          leadId,
          leadNumber,
          actionUrl: actionUrlPickupBoy,
          metadata: { kind: 'ROUTE_DELAY', mode, distance_km: distanceKm },
        });
      }

      for (const adminId of adminUserIds) {
        const alreadyAdmin = await recentlyNotified({ supabaseAdmin, userId: adminId, leadId, type, windowMinutes: 10 });
        if (alreadyAdmin) continue;
        await createNotificationAdmin({
          supabaseAdmin,
          userId: adminId,
          type,
          title: 'Pickup boy route delay',
          message: `Lead ${leadNumber}: Route delay / missing GPS updates detected.`,
          priority: 'MEDIUM',
          leadId,
          leadNumber,
          actionUrl: actionUrlAdmin,
          metadata: { kind: 'ROUTE_DELAY', mode, pickup_boy_id: userProfile.id, distance_km: distanceKm },
        });
        adminAlerted = true;
      }
    }

    return NextResponse.json(
      {
        success: true,
        recorded: true,
        distance_km: distanceKm,
        deviation_detected: deviationDetected,
        delay_detected: delayDetected,
        admin_alerts: adminAlerted,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


