import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createNotification, notifyWorkshopRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const REQUIRED_BEFORE_TYPES = [
  'BEFORE_FRONT',
  'BEFORE_REAR',
  'BEFORE_LEFT',
  'BEFORE_RIGHT',
  'BEFORE_DASHBOARD',
  'BEFORE_ENGINE_BAY',
];

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

    // Get user profile with role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, workshop_id, roles!inner(role_code)')
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

    // Get request body
    const body = await request.json();
    const { notes, odometer_reading, fuel_level } = body;

    const leadId = params.id;

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Pickup task not found' }, { status: 404 });
    }

    // Verify task is assigned to this pickup boy
    if (lead.assigned_pickup_boy_id !== userProfile.id) {
      return NextResponse.json({ error: 'Pickup task not assigned to you' }, { status: 403 });
    }

    // If lead has already moved ahead (READY_FOR_BILLING/DELIVERY), do not change lead.status,
    // but still persist pickup tracking fields (arrival time + pickup odometer reading).
    const protectedStatuses = ['COMPLETED', 'WORK_COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'];
    const isProtected = protectedStatuses.includes(String(lead.status || '').toUpperCase());

    // Verify pickup status is VEHICLE_IN_TRANSIT or VEHICLE_DROPPED_AT_WORKSHOP
    // Allow both statuses - VEHICLE_IN_TRANSIT means still driving, VEHICLE_DROPPED_AT_WORKSHOP means arrived
    if (lead.pickup_status !== 'VEHICLE_IN_TRANSIT' && lead.pickup_status !== 'VEHICLE_DROPPED_AT_WORKSHOP') {
      return NextResponse.json({ 
        error: 'Pickup must be in VEHICLE_IN_TRANSIT or VEHICLE_DROPPED_AT_WORKSHOP status',
        current_status: lead.pickup_status,
        hint: 'Please mark as arrived at workshop first'
      }, { status: 400 });
    }

    // Check if OTP was verified
    const { data: otpVerified } = await supabase
      .from('pickup_otps')
      .select('is_verified')
      .eq('lead_id', leadId)
      .eq('otp_type', 'PICKUP')
      .eq('is_verified', true)
      .single();

    if (!otpVerified) {
      return NextResponse.json({ 
        error: 'OTP must be verified before completing pickup',
        hint: 'Verify customer OTP first'
      }, { status: 400 });
    }

    // Observation gating (per-lead). Backwards compatible if columns not yet migrated.
    try {
      const obsRequired = !!(lead as any)?.pickup_observation_required;
      const obsText = String((lead as any)?.pickup_observation || '').trim();
      if (obsRequired && !obsText) {
        return NextResponse.json(
          { error: 'Observation report pending', hint: 'Submit observation report to continue' },
          { status: 400 }
        );
      }
    } catch {
      // ignore
    }

    // Check if mandatory pickup photos are uploaded (matches BeforeInspectionUpload required slots).
    // NOTE: pickup photos are stored in lead_media with category/photo_type like BEFORE_FRONT, BEFORE_DASHBOARD, etc.
    let requiredUploadedCount = 0;
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
      requiredUploadedCount = REQUIRED_BEFORE_TYPES.filter((t) => beforeSet.has(t)).length;

      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: 'Mandatory pickup photos pending',
            message: 'Please upload all compulsory pickup photos before completing pickup.',
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

    // Update lead status to VEHICLE_DROPPED_AT_WORKSHOP (vehicle at workshop, ready for service)
    // If lead is already progressed, only update odometer fields (best-effort) and keep status unchanged.
    let updatedLead: any = lead;
    if (!isProtected) {
      const { data: up, error: updateError } = await supabase
        .from('service_leads')
        .update({
          pickup_status: 'VEHICLE_DROPPED_AT_WORKSHOP', // ✨ NEW: Updated status
          status: 'VEHICLE_DROPPED_AT_WORKSHOP',
          vehicle_odometer: odometer_reading || lead.vehicle_odometer,
          updated_at: now
        })
        .eq('id', leadId)
        .select()
        .single();

      if (updateError) {
        console.error('Error completing pickup:', updateError);
        return NextResponse.json({ error: 'Failed to complete pickup' }, { status: 500 });
      }
      updatedLead = up;
    } else {
      // Best-effort odometer persist without touching status
      if (odometer_reading) {
        await supabase
          .from('service_leads')
          .update({
            vehicle_odometer: (lead as any)?.vehicle_odometer || odometer_reading,
            updated_at: now,
          } as any)
          .eq('id', leadId);
      }
    }

    // Update pickup tracking with all new fields
    // Upsert pickup_tracking (some flows may not have created a tracking row yet)
    await supabase
      .from('pickup_tracking')
      .upsert(
        {
          lead_id: leadId,
          pickup_required: true,
          pickup_assigned_to: (lead as any)?.assigned_pickup_boy_id || userProfile.id,
          pickup_status: 'VEHICLE_DROPPED_AT_WORKSHOP', // ✨ NEW: Updated status
          pickup_arrival_time: now,
          pickup_handover_to_workshop_at: now, // ✨ NEW: When keys handed over
          pickup_odometer_reading: odometer_reading || null, // ✨ NEW: Odometer reading at pickup
          pickup_notes: notes || 'Vehicle delivered to workshop',
          updated_at: now,
          created_at: now,
        } as any,
        { onConflict: 'lead_id' }
      );

    // Log status change (only if we changed main lead status)
    if (!isProtected) {
      await supabase
        .from('lead_status_history')
        .insert({
          lead_id: leadId,
          old_status: lead.status,
          new_status: 'VEHICLE_DROPPED_AT_WORKSHOP',
          changed_by: userProfile.id,
          changed_at: now,
          reason: 'Vehicle delivered to workshop by pickup boy',
          notes: notes || 'Vehicle dropped at workshop, ready for service'
        });
    }

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'PICKUP_COMPLETED',
        description: 'Vehicle delivered to workshop',
        old_status: lead.status,
        new_status: 'VEHICLE_DROPPED_AT_WORKSHOP',
        metadata: {
          pickup_boy_id: userProfile.id,
          delivered_at: now,
          odometer_reading: odometer_reading,
          fuel_level: fuel_level,
          notes: notes,
          before_images_count: requiredUploadedCount
        }
      });

    // In-app notifications (Phase A)
    try {
      const leadNumber = (lead as any)?.lead_number || leadId;
      const msg = `Vehicle delivered to workshop for lead ${leadNumber}. Ready for service.`;

      if ((lead as any)?.assigned_mechanic_id) {
        await createNotification({
          userId: (lead as any).assigned_mechanic_id,
          type: 'PICKUP_COMPLETED',
          title: 'Vehicle dropped at workshop',
          message: msg,
          priority: 'MEDIUM',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`,
        });
      }

      if ((lead as any)?.assigned_supervisor_id) {
        await createNotification({
          userId: (lead as any).assigned_supervisor_id,
          type: 'PICKUP_COMPLETED',
          title: 'Vehicle dropped at workshop',
          message: msg,
          priority: 'MEDIUM',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop-advisor/jobs/${leadId}`,
        });
      }

      if ((lead as any)?.workshop_id) {
        await notifyWorkshopRoles({
          workshopId: (lead as any).workshop_id,
          roleCodes: ['WORKSHOP_ADMIN'],
          type: 'PICKUP_COMPLETED',
          title: 'Vehicle dropped at workshop',
          message: msg,
          priority: 'LOW',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_admin/leads/pending`,
        });
      }
    } catch (e) {
      console.warn('Pickup completed notifications failed (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      message: 'Pickup completed successfully - Vehicle delivered to workshop',
      lead: updatedLead,
      next_step: 'Mechanic will start working on the vehicle',
      delivery_summary: {
        delivered_at: now,
        odometer_reading: odometer_reading,
        fuel_level: fuel_level,
        before_images_count: requiredUploadedCount
      },
      note: isProtected ? 'Lead status not changed (already progressed); tracking/odometer saved.' : undefined
    }, { status: 200 });

  } catch (error) {
    console.error('Error in complete pickup API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

