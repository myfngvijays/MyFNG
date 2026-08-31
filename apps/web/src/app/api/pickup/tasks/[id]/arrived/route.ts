import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createNotification, notifyPickupBoy, notifyWorkshopRoles } from '@/lib/notifications';
import { checkMandatoryPickupPhotos, isDummyPickupLead } from '@/lib/workshop/pickupPhotos';

export const dynamic = 'force-dynamic';

const IN_TRANSIT_STATUSES = ['VEHICLE_IN_TRANSIT', 'OTP_VERIFIED', 'PICKED', 'ON_THE_WAY'];

/**
 * POST /api/pickup/tasks/[id]/arrived
 * Mark vehicle as arrived at workshop (status: VEHICLE_DROPPED_AT_WORKSHOP)
 */
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClientFromRequest(request);
    const params = await paramsPromise;
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is pickup boy
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_PICKUP_BOY') {
      return NextResponse.json({ error: 'Forbidden: Pickup Boy only' }, { status: 403 });
    }

    const leadId = params.id;

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Verify task is assigned to this pickup boy
    if (lead.assigned_pickup_boy_id !== userProfile.id) {
      return NextResponse.json({ error: 'Pickup task not assigned to you' }, { status: 403 });
    }

    // Verify pickup is required
    if (!lead.pickup_required) {
      return NextResponse.json({ 
        error: 'Pickup not required for this lead' 
      }, { status: 400 });
    }

    // Prevent overwriting COMPLETED or later statuses
    const protectedStatuses = ['COMPLETED', 'WORK_COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'];

    // Verify vehicle is en route or OTP-verified with photos uploaded
    const { data: trackingRow } = await supabase
      .from('pickup_tracking')
      .select('pickup_status')
      .eq('lead_id', leadId)
      .maybeSingle();

    const leadStatus = String(lead.status || '').toUpperCase();
    const leadPickup = String(lead.pickup_status || '').toUpperCase();
    const trackingPickup = String(trackingRow?.pickup_status || '').toUpperCase();

    const canArrive =
      IN_TRANSIT_STATUSES.includes(leadStatus) ||
      IN_TRANSIT_STATUSES.includes(leadPickup) ||
      IN_TRANSIT_STATUSES.includes(trackingPickup);

    if (!canArrive) {
      return NextResponse.json({
        error: 'Vehicle must be picked up and in transit before marking as arrived',
        current_status: lead.status,
        current_pickup_status: lead.pickup_status,
        tracking_pickup_status: trackingRow?.pickup_status,
      }, { status: 400 });
    }

    if (!isDummyPickupLead(lead)) {
      const photoCheck = await checkMandatoryPickupPhotos(supabase, leadId);
      if (!photoCheck.ok) {
        return NextResponse.json(
          {
            error: 'Mandatory pickup photos pending',
            message: 'Please upload all compulsory pickup photos before marking Arrived at Workshop.',
            missing_photos: photoCheck.missing,
          },
          { status: 400 },
        );
      }
    }

    const now = new Date().toISOString();

    // pickup_tracking.pickup_status enum may lack VEHICLE_DROPPED_AT_WORKSHOP on older DBs
    const trackingArrivedStatus = 'DROPPED';

    // Always persist tracking timestamps.
    // If lead has already moved ahead (READY_FOR_BILLING/DELIVERY), do not change lead.status.
    const isProtected = protectedStatuses.includes(String(lead.status || '').toUpperCase());
    if (!isProtected) {
      // Update service_leads status to VEHICLE_DROPPED_AT_WORKSHOP
      const { error: updateLeadError } = await supabase
        .from('service_leads')
        .update({
          pickup_status: 'VEHICLE_DROPPED_AT_WORKSHOP',
          status: 'VEHICLE_DROPPED_AT_WORKSHOP',
          updated_at: now
        })
        .eq('id', leadId);

      if (updateLeadError) {
        console.error('Error updating lead status:', updateLeadError);
        return NextResponse.json({ 
          error: 'Failed to update lead status', 
          details: updateLeadError.message 
        }, { status: 500 });
      }
    }

    // Upsert pickup_tracking (some flows may not have created a tracking row yet)
    await supabase
      .from('pickup_tracking')
      .upsert(
        {
          lead_id: leadId,
          pickup_required: true,
          pickup_assigned_to: (lead as any)?.assigned_pickup_boy_id || userProfile.id,
          pickup_status: trackingArrivedStatus,
          pickup_arrival_time: now,
          // Treat arrival at workshop as handover time as well (keys handed)
          pickup_handover_to_workshop_at: now,
          updated_at: now,
          created_at: now,
        } as any,
        { onConflict: 'lead_id' }
      );

    // Best-effort: persist timestamps on service_leads too (so supervisor UI can show time even if RLS blocks pickup_tracking)
    // Some deployments may not have these columns; ignore unknown-column errors.
    try {
      const attempt = await supabase
        .from('service_leads')
        .update(
          {
            pickup_arrival_time: now,
            pickup_handover_to_workshop_at: now,
            updated_at: now,
          } as any
        )
        .eq('id', leadId);
      // @ts-ignore
      if (attempt?.error && (attempt.error as any)?.code === '42703') {
        // column does not exist
      }
    } catch {
      // ignore
    }

    // Log status change
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'VEHICLE_DROPPED_AT_WORKSHOP',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Vehicle arrived at workshop',
        notes: 'Pickup boy marked vehicle as arrived at workshop'
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'VEHICLE_ARRIVED_AT_WORKSHOP',
        description: 'Vehicle arrived at workshop',
        old_status: lead.status,
        new_status: 'VEHICLE_DROPPED_AT_WORKSHOP',
        metadata: {
          pickup_boy_id: userProfile.id,
          arrived_at: now
        }
      });

    // In-app notifications (Phase A)
    try {
      const leadNumber = (lead as any)?.lead_number || leadId;
      const msg = `Vehicle arrived at workshop for lead ${leadNumber}. Begin inspection.`;

      // Pickup boy confirmation / next action
      await notifyPickupBoy({
        pickupBoyId: userProfile.id,
        type: 'PICKUP_ARRIVED',
        title: 'Arrived at workshop',
        message: `Lead ${leadNumber}: Vehicle dropped at workshop. Pickup leg complete.`,
        priority: 'MEDIUM',
        leadId,
        leadNumber,
        metadata: { kind: 'PICKUP_ARRIVED' },
      });

      if ((lead as any)?.assigned_mechanic_id) {
        await createNotification({
          userId: (lead as any).assigned_mechanic_id,
          type: 'SYSTEM_ALERT',
          title: 'Vehicle ready for service',
          message: msg,
          priority: 'HIGH',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`,
          metadata: { kind: 'VEHICLE_READY' },
        });
      }

      if ((lead as any)?.assigned_supervisor_id) {
        await createNotification({
          userId: (lead as any).assigned_supervisor_id,
          type: 'SYSTEM_ALERT',
          title: 'Vehicle arrived at workshop',
          message: msg,
          priority: 'MEDIUM',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop-advisor/jobs/${leadId}`,
          metadata: { kind: 'VEHICLE_READY' },
        });
      }

      if ((lead as any)?.workshop_id) {
        await notifyWorkshopRoles({
          workshopId: (lead as any).workshop_id,
          roleCodes: ['WORKSHOP_ADMIN'],
          type: 'SYSTEM_ALERT',
          title: 'Vehicle arrived at workshop',
          message: msg,
          priority: 'LOW',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_admin/leads/${leadId}`,
          metadata: { kind: 'VEHICLE_READY' },
        });
      }

      // Customer-facing timeline event (public tracking page polls lead_events)
      await supabase.from('lead_events').insert({
        lead_id: leadId,
        event_type: 'VEHICLE_ARRIVED_AT_WORKSHOP',
        event_description: `Your vehicle has arrived safely at the workshop.`,
        created_by: userProfile.id,
        created_at: now,
      } as any);
    } catch (e) {
      console.warn('Vehicle arrived notifications failed (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      message: 'Vehicle marked as arrived at workshop',
      status: isProtected ? lead.status : 'VEHICLE_DROPPED_AT_WORKSHOP',
      note: isProtected ? 'Lead status not changed (already progressed); tracking timestamps updated.' : undefined
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in arrived API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

