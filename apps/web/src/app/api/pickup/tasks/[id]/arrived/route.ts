import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createNotification, notifyPickupBoy, notifyWorkshopRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const REQUIRED_BEFORE_TYPES = [
  'BEFORE_FRONT',
  'BEFORE_REAR',
  'BEFORE_LEFT',
  'BEFORE_RIGHT',
  'BEFORE_DASHBOARD',
  'BEFORE_ENGINE_BAY',
];

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

    // Verify current status is VEHICLE_IN_TRANSIT
    if (lead.pickup_status !== 'VEHICLE_IN_TRANSIT' && lead.status !== 'VEHICLE_IN_TRANSIT') {
      return NextResponse.json({ 
        error: 'Vehicle must be in transit before marking as arrived',
        current_status: lead.status,
        current_pickup_status: lead.pickup_status
      }, { status: 400 });
    }

    // Enforce mandatory pickup photos (front/rear/left/right/dashboard/engine bay)
    // before allowing "Arrived at Workshop". This matches BeforeInspectionUpload required slots.
    try {
      const { data: mediaRows, error: mediaError } = await supabase
        .from('lead_media')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (mediaError) {
        return NextResponse.json(
          { error: 'Failed to verify mandatory pickup photos', details: mediaError.message },
          { status: 500 }
        );
      }

      const inferSlot = (row: any) => {
        const t = String(row?.photo_type || row?.category || '').trim().toUpperCase();
        if (t) return t;
        const fn = String(row?.file_name || '').trim();
        const m = fn.match(/^(BEFORE_[A-Z0-9_]+)__+/);
        return m?.[1] ? String(m[1]).toUpperCase() : '';
      };

      const beforeSet = new Set<string>();
      for (const row of mediaRows || []) {
        const slot = inferSlot(row);
        if (slot && slot.startsWith('BEFORE_')) beforeSet.add(slot);
      }

      const missing = REQUIRED_BEFORE_TYPES.filter((t) => !beforeSet.has(t));
      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: 'Mandatory pickup photos pending',
            message: 'Please upload all compulsory pickup photos before marking Arrived at Workshop.',
            missing_photos: missing,
            required_photos: REQUIRED_BEFORE_TYPES,
          },
          { status: 400 }
        );
      }
    } catch (e: any) {
      return NextResponse.json(
        { error: 'Failed to verify mandatory pickup photos', details: e?.message || String(e) },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();

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
          pickup_status: 'VEHICLE_DROPPED_AT_WORKSHOP',
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
        type: 'HANDOVER_PENDING',
        title: 'Vehicle delivered to workshop',
        message: `Lead ${leadNumber}: Vehicle delivered. Complete handover checklist to close pickup.`,
        priority: 'MEDIUM',
        leadId,
        leadNumber,
        metadata: { kind: 'HANDOVER_PENDING' },
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
          actionUrl: `/dashboard/workshop_supervisor/jobs/${leadId}`,
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

