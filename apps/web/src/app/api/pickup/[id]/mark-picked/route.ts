import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { notifyPickupBoy, notifyWorkshopRoles } from '@/lib/notifications';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { isDummyPickupLead } from '@/lib/workshop/pickupPhotos';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pickup/[id]/mark-picked
 * Mark vehicle as picked (in transit to workshop)
 */
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClientFromRequest(request);
    const params = await paramsPromise;
    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfigured', details: adminErr }, { status: 500 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as { role_code?: string } | null)?.role_code;
    if (roleCode !== 'WORKSHOP_PICKUP_BOY') {
      return NextResponse.json({ error: 'Forbidden: Pickup Boy only' }, { status: 403 });
    }

    const leadId = params.id;
    const body = await request.json().catch(() => ({}));
    const { notes, latitude, longitude } = body || {};

    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.assigned_pickup_boy_id && lead.assigned_pickup_boy_id !== userProfile.id) {
      return NextResponse.json({ error: 'Pickup task not assigned to you' }, { status: 403 });
    }

    const isDummyLead = isDummyPickupLead(lead);

    try {
      const obsRequired = !!(lead as { pickup_observation_required?: boolean }).pickup_observation_required;
      const obsText = (lead as { pickup_observation?: string | null }).pickup_observation || null;
      if (obsRequired && !String(obsText || '').trim()) {
        return NextResponse.json(
          { error: 'Observation report pending', hint: 'Submit observation report to continue' },
          { status: 400 },
        );
      }
    } catch {
      // column may not exist
    }

    const { count: photoCount, error: photoCountError } = await supabaseAdmin
      .from('vehicle_condition_photos')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .like('photo_type', 'PICKUP_%');

    if (photoCountError) {
      return NextResponse.json({ error: 'Failed to check photos', details: photoCountError.message }, { status: 500 });
    }

    if (!isDummyLead && (photoCount || 0) < 4) {
      return NextResponse.json(
        {
          error: 'Minimum 4 pickup photos required',
          required_photos: ['PICKUP_FRONT', 'PICKUP_LEFT', 'PICKUP_RIGHT', 'PICKUP_INTERIOR'],
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    // pickup_tracking.pickup_status is a Postgres ENUM — older DBs may lack VEHICLE_IN_TRANSIT.
    // Use PICKED on tracking; service_leads (varchar) keeps VEHICLE_IN_TRANSIT for advisor UI.
    const trackingPickupStatus = 'PICKED';

    const { error: upsertTrackingError } = await supabaseAdmin.from('pickup_tracking').upsert(
      {
        lead_id: leadId,
        pickup_required: true,
        pickup_assigned_to: userProfile.id,
        pickup_status: trackingPickupStatus,
        pickup_picked_time: now,
        pickup_in_transit_at: now,
        pickup_notes: notes || null,
        pickup_address: lead.pickup_address || lead.customer_address || lead.address,
        pickup_latitude: lead.pickup_latitude || lead.customer_lat,
        pickup_longitude: lead.pickup_longitude || lead.customer_lng,
        updated_at: now,
      } as Record<string, unknown>,
      { onConflict: 'lead_id' },
    );

    if (upsertTrackingError) {
      return NextResponse.json(
        { error: 'Failed to mark as picked', details: upsertTrackingError.message },
        { status: 500 },
      );
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('pickup_tracking')
      .update({
        pickup_status: trackingPickupStatus,
        pickup_picked_time: now,
        pickup_in_transit_at: now,
        pickup_notes: notes || null,
        updated_at: now,
      })
      .eq('lead_id', leadId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to mark as picked', details: updateError.message },
        { status: 500 },
      );
    }

    const { error: leadUpdateError } = await supabaseAdmin
      .from('service_leads')
      .update({
        status: 'VEHICLE_IN_TRANSIT',
        pickup_status: 'VEHICLE_IN_TRANSIT',
        updated_at: now,
      })
      .eq('id', leadId);

    if (leadUpdateError) {
      return NextResponse.json(
        { error: 'Failed to update lead status', details: leadUpdateError.message },
        { status: 500 },
      );
    }

    if (latitude && longitude) {
      await supabaseAdmin.from('pickup_location_tracking').insert({
        lead_id: leadId,
        pickup_boy_id: user.id,
        latitude,
        longitude,
        status: 'AT_PICKUP',
      });
    }

    await supabaseAdmin.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'VEHICLE_PICKED',
      description: 'Vehicle picked up by pickup boy',
      metadata: { notes, latitude, longitude, dummy: isDummyLead },
    });

    await supabaseAdmin.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'VEHICLE_IN_TRANSIT',
      event_description: 'Your vehicle is on the way to the workshop.',
      created_by: user.id,
    } as Record<string, unknown>);

    try {
      const leadNumber = lead.lead_number || leadId;

      await notifyPickupBoy({
        pickupBoyId: user.id,
        type: 'PICKUP_COMPLETED',
        title: 'Vehicle marked as picked',
        message: `Lead ${leadNumber}: Vehicle picked up. Drive to workshop and tap Mark Arrived when you reach.`,
        priority: 'MEDIUM',
        leadId,
        leadNumber,
        metadata: { kind: 'VEHICLE_PICKED' },
      });

      if (lead.workshop_id) {
        await notifyWorkshopRoles({
          workshopId: lead.workshop_id,
          roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
          type: 'PICKUP_COMPLETED',
          title: 'Vehicle picked up',
          message: `Lead ${leadNumber}: Vehicle picked up by pickup boy. In transit to workshop.`,
          priority: 'LOW',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop-advisor/pickup-delivery`,
          metadata: { kind: 'PICKUP_COMPLETED' },
        });
      }
    } catch (e) {
      console.warn('Pickup completed notifications failed (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Vehicle marked as picked successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error marking as picked:', error);
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
