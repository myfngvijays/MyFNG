import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createNotification, notifyPickupBoy } from '@/lib/notifications';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

const STARTED_DROP_STATUSES = new Set([
  'OUT_FOR_DELIVERY',
  'IN_TRANSIT',
  'ARRIVED_AT_CUSTOMER',
]);

const COMPLETED_DROP_STATUSES = new Set(['DELIVERED']);

const ADVISOR_ROLES = new Set([
  'WORKSHOP_ADMIN',
  'WORKSHOP_SUPERVISOR',
  'WORKSHOP_ADVISOR',
  'WORKSHOP_ADVISER',
]);

function roleCodeOf(row: { roles?: unknown } | null): string {
  const roles = row?.roles as { role_code?: string } | { role_code?: string }[] | null | undefined;
  if (Array.isArray(roles)) return String(roles[0]?.role_code || '');
  return String(roles?.role_code || '');
}

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClientFromRequest(request);
    const params = await paramsPromise;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profileById, error: profileError } = await supabase
      .from('users_login')
      .select('id, full_name, workshop_id, roles(role_code)')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: 'User profile lookup failed', details: profileError.message },
        { status: 500 }
      );
    }

    let profile = profileById;
    if (!profile && user.email) {
      const { data: byEmail } = await supabase
        .from('users_login')
        .select('id, full_name, workshop_id, roles(role_code)')
        .ilike('email', user.email)
        .maybeSingle();
      profile = byEmail;
    }

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = roleCodeOf(profile);
    if (!ADVISOR_ROLES.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden: Workshop Admin or Supervisor only' }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { pickup_boy_id?: string };
    const pickupBoyId = String(body?.pickup_boy_id || '').trim();

    if (!pickupBoyId) {
      return NextResponse.json({ error: 'pickup_boy_id is required' }, { status: 400 });
    }

    const leadId = params.id;
    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin ?? supabase;

    const { data: lead, error: leadError } = await db
      .from('service_leads')
      .select('id, lead_number, workshop_id, status, read_only, assigned_pickup_boy_id')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.read_only) {
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
    }

    if (!profile.workshop_id || lead.workshop_id !== profile.workshop_id) {
      return NextResponse.json({ error: 'Lead does not belong to your workshop' }, { status: 403 });
    }

    const leadStatus = String(lead.status || '').toUpperCase();
    const allowedLeadStatuses = ['READY_FOR_DELIVERY', 'COD_PENDING'];
    if (!allowedLeadStatuses.includes(leadStatus)) {
      return NextResponse.json(
        {
          error:
            leadStatus === 'DELIVERED'
              ? 'Lead is still marked Delivered. Set it back to Ready for Delivery, then assign.'
              : 'Lead is not in delivery stage',
          current_status: lead.status,
        },
        { status: 400 }
      );
    }

    const { data: pickupBoy, error: pickupBoyError } = await db
      .from('users_login')
      .select('id, full_name, workshop_id, roles(role_code)')
      .eq('id', pickupBoyId)
      .eq('workshop_id', profile.workshop_id)
      .maybeSingle();

    if (pickupBoyError || !pickupBoy) {
      return NextResponse.json({ error: 'Invalid pickup boy for this workshop' }, { status: 400 });
    }

    if (roleCodeOf(pickupBoy) !== 'WORKSHOP_PICKUP_BOY') {
      return NextResponse.json({ error: 'Selected user is not a pickup boy' }, { status: 400 });
    }

    const { data: tracking } = await db
      .from('pickup_tracking')
      .select(
        'lead_id, drop_status, drop_start_time, drop_out_for_delivery_at, drop_in_transit_at, drop_arrived_at, drop_completed_time, drop_otp_verified_at, drop_otp, drop_assigned_to'
      )
      .eq('lead_id', leadId)
      .maybeSingle();

    const dropStatus = String((tracking as any)?.drop_status || '').toUpperCase();
    const deliveryCompleted =
      COMPLETED_DROP_STATUSES.has(dropStatus) ||
      Boolean((tracking as any)?.drop_completed_time) ||
      Boolean((tracking as any)?.drop_otp_verified_at);

    if (deliveryCompleted) {
      return NextResponse.json(
        { error: 'Delivery already completed; cannot reassign' },
        { status: 400 }
      );
    }

    const deliveryStarted =
      Boolean((tracking as any)?.drop_start_time) || STARTED_DROP_STATUSES.has(dropStatus);

    const now = new Date().toISOString();
    const oldPickupBoyId = (tracking as any)?.drop_assigned_to || null;

    if (oldPickupBoyId && oldPickupBoyId === pickupBoyId) {
      return NextResponse.json({ success: true, message: 'Already assigned for delivery' }, { status: 200 });
    }

    const trackingPayload: Record<string, any> = {
      lead_id: leadId,
      drop_required: true,
      drop_assigned_to: pickupBoyId,
      drop_assigned_at: now,
      updated_at: now,
    };

    if (!deliveryStarted) {
      trackingPayload.drop_status = 'ASSIGNED';
      trackingPayload.drop_start_time = null;
      trackingPayload.drop_out_for_delivery_at = null;
      trackingPayload.drop_in_transit_at = null;
      trackingPayload.drop_arrived_at = null;
      trackingPayload.drop_completed_time = null;
      trackingPayload.drop_otp_verified_at = null;
      trackingPayload.drop_otp = null;
    }

    const { error: trackingError } = await db
      .from('pickup_tracking')
      .upsert(trackingPayload, { onConflict: 'lead_id' });

    if (trackingError) {
      return NextResponse.json(
        { error: 'Failed to update delivery tracking', details: trackingError.message },
        { status: 500 }
      );
    }

    await db.from('lead_activities').insert({
      lead_id: leadId,
      user_id: profile.id,
      activity_type: 'DELIVERY_REASSIGNED',
      description: deliveryStarted ? 'Delivery reassigned while in progress' : 'Delivery assigned',
      metadata: {
        old_pickup_boy_id: oldPickupBoyId,
        new_pickup_boy_id: pickupBoyId,
        delivery_started: deliveryStarted,
        drop_status: dropStatus || null,
      },
    });

    const leadNumber = (lead as any)?.lead_number || leadId;
    const pickupBoyName = String((pickupBoy as any)?.full_name || 'pickup boy');
    const deliveryTitle = deliveryStarted ? 'Delivery reassigned' : 'Delivery assigned';
    const deliveryMeta = {
      kind: 'DELIVERY_REASSIGNED',
      delivery_started: deliveryStarted,
      pickup_boy_id: pickupBoyId,
    };

    try {
      await notifyPickupBoy({
        pickupBoyId,
        type: 'DELIVERY_ASSIGNED',
        title: deliveryTitle,
        message: deliveryStarted
          ? `Lead ${leadNumber}: Delivery reassigned to you (in progress).`
          : `Lead ${leadNumber}: You are assigned to deliver this car.`,
        priority: 'HIGH',
        leadId,
        leadNumber,
        metadata: deliveryMeta,
      });
    } catch (e) {
      console.warn('Delivery pickup-boy notification failed (non-blocking):', e);
    }

    try {
      await createNotification({
        userId: profile.id,
        type: 'DELIVERY_ASSIGNED',
        title: deliveryTitle,
        message: deliveryStarted
          ? `Lead ${leadNumber}: Delivery reassigned to ${pickupBoyName}.`
          : `Lead ${leadNumber}: Delivery assigned to ${pickupBoyName}.`,
        priority: 'HIGH',
        leadId,
        leadNumber,
        relatedUserId: pickupBoyId,
        relatedUserName: pickupBoyName,
        actionUrl: `/dashboard/workshop-advisor/pickup-delivery`,
        metadata: deliveryMeta,
      });
    } catch (e) {
      console.warn('Delivery advisor notification failed (non-blocking):', e);
    }

    if (oldPickupBoyId && oldPickupBoyId !== pickupBoyId) {
      try {
        await notifyPickupBoy({
          pickupBoyId: oldPickupBoyId,
          type: 'SYSTEM_ALERT',
          title: 'Delivery reassigned',
          message: `Lead ${leadNumber}: Delivery reassigned to another pickup boy.`,
          priority: 'MEDIUM',
          leadId,
          leadNumber,
          metadata: { kind: 'DELIVERY_REASSIGNED', new_pickup_boy_id: pickupBoyId },
        });
      } catch (e) {
        console.warn('Old pickup-boy delivery notification failed (non-blocking):', e);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Delivery assigned successfully',
        delivery_started: deliveryStarted,
        old_pickup_boy_id: oldPickupBoyId,
        new_pickup_boy_id: pickupBoyId,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error reassigning delivery:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
