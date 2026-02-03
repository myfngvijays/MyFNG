import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyPickupBoy } from '@/lib/notifications';

const STARTED_DROP_STATUSES = new Set([
  'OUT_FOR_DELIVERY',
  'IN_TRANSIT',
  'ARRIVED_AT_CUSTOMER',
]);

const COMPLETED_DROP_STATUSES = new Set(['DELIVERED']);

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const params = await paramsPromise;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, full_name, workshop_id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_ADMIN' && roleCode !== 'WORKSHOP_SUPERVISOR') {
      return NextResponse.json({ error: 'Forbidden: Workshop Admin or Supervisor only' }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { pickup_boy_id?: string };
    const pickupBoyId = String(body?.pickup_boy_id || '').trim();

    if (!pickupBoyId) {
      return NextResponse.json({ error: 'pickup_boy_id is required' }, { status: 400 });
    }

    const leadId = params.id;
    const { data: lead, error: leadError } = await supabase
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

    if (!userProfile.workshop_id || lead.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Lead does not belong to your workshop' }, { status: 403 });
    }

    const allowedLeadStatuses = ['READY_FOR_DELIVERY', 'COD_PENDING'];
    if (!allowedLeadStatuses.includes(String(lead.status || '').toUpperCase())) {
      return NextResponse.json(
        { error: 'Lead is not in delivery stage', current_status: lead.status },
        { status: 400 }
      );
    }

    const { data: pickupBoy, error: pickupBoyError } = await supabase
      .from('users_login')
      .select('id, full_name, workshop_id, roles!inner(role_code)')
      .eq('id', pickupBoyId)
      .eq('workshop_id', userProfile.workshop_id)
      .maybeSingle();

    if (pickupBoyError || !pickupBoy) {
      return NextResponse.json({ error: 'Invalid pickup boy for this workshop' }, { status: 400 });
    }

    const pickupBoyRoleCode = (pickupBoy.roles as any)?.role_code;
    if (pickupBoyRoleCode !== 'WORKSHOP_PICKUP_BOY') {
      return NextResponse.json({ error: 'Selected user is not a pickup boy' }, { status: 400 });
    }

    const { data: tracking } = await supabase
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
      Boolean((tracking as any)?.drop_otp_verified_at) ||
      String(lead.status || '').toUpperCase() === 'DELIVERED';

    if (deliveryCompleted) {
      return NextResponse.json(
        { error: 'Delivery already completed; cannot reassign' },
        { status: 400 }
      );
    }

    const deliveryStarted =
      Boolean((tracking as any)?.drop_start_time) || STARTED_DROP_STATUSES.has(dropStatus);

    const oldPickupBoyId = (tracking as any)?.drop_assigned_to || (lead as any)?.assigned_pickup_boy_id || null;

    if (oldPickupBoyId && oldPickupBoyId === pickupBoyId) {
      return NextResponse.json({ success: true, message: 'Pickup boy already assigned' }, { status: 200 });
    }

    const now = new Date().toISOString();

    // Update service lead assignment (this gates delivery actions)
    const { error: leadUpdateError } = await supabase
      .from('service_leads')
      .update({
        assigned_pickup_boy_id: pickupBoyId,
        pickup_assigned_at: now,
        updated_at: now,
      })
      .eq('id', leadId);

    if (leadUpdateError) {
      return NextResponse.json(
        { error: 'Failed to update lead assignment', details: leadUpdateError.message },
        { status: 500 }
      );
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

    const { error: trackingError } = await supabase
      .from('pickup_tracking')
      .upsert(trackingPayload, { onConflict: 'lead_id' });

    if (trackingError) {
      return NextResponse.json(
        { error: 'Failed to update delivery tracking', details: trackingError.message },
        { status: 500 }
      );
    }

    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: userProfile.id,
      activity_type: 'DELIVERY_REASSIGNED',
      description: deliveryStarted ? 'Delivery reassigned while in progress' : 'Delivery reassigned before start',
      metadata: {
        old_pickup_boy_id: oldPickupBoyId,
        new_pickup_boy_id: pickupBoyId,
        delivery_started: deliveryStarted,
        drop_status: dropStatus || null,
      },
    });

    const leadNumber = (lead as any)?.lead_number || leadId;

    // Notify new pickup boy
    try {
      await notifyPickupBoy({
        pickupBoyId,
        type: 'DELIVERY_ASSIGNED',
        title: 'Delivery reassigned',
        message: deliveryStarted
          ? `Lead ${leadNumber}: Delivery reassigned to you (in progress).`
          : `Lead ${leadNumber}: Delivery assigned to you.`,
        priority: 'HIGH',
        leadId,
        leadNumber,
        metadata: { kind: 'DELIVERY_REASSIGNED', delivery_started: deliveryStarted },
      });
    } catch {
      // non-blocking
    }

    // Notify old pickup boy (if any)
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
      } catch {
        // non-blocking
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Delivery reassigned successfully',
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
