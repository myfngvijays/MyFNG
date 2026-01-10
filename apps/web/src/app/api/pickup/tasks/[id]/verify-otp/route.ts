import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createNotification, notifyWorkshopRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClientFromRequest(request);
    
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
    const { otp, otp_type } = body;
    const otpType = String(otp_type || 'PICKUP').toUpperCase(); // PICKUP | DROP

    if (!otp) {
      return NextResponse.json({ error: 'OTP is required' }, { status: 400 });
    }

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

    // For PICKUP OTP we should not modify leads once work progressed too far.
    // For DROP OTP we must allow READY_FOR_DELIVERY / COD_PENDING.
    if (otpType === 'PICKUP') {
      const protectedStatuses = [
        'COMPLETED',
        'WORK_COMPLETED',
        'QC_PENDING',
        'QC_APPROVED',
        'READY_FOR_BILLING',
        'READY_FOR_DELIVERY',
        'DELIVERED',
        'CLOSED',
      ];
    if (protectedStatuses.includes(lead.status)) {
        return NextResponse.json(
          {
        error: 'Cannot update status - work already completed',
        current_status: lead.status,
            message: 'Mechanic has already completed the work. Status cannot be changed.',
          },
          { status: 400 }
        );
      }
    } else if (otpType === 'DROP') {
      const allowedLeadStatuses = ['READY_FOR_DELIVERY', 'COD_PENDING'];
      if (!allowedLeadStatuses.includes(lead.status)) {
        return NextResponse.json(
          { error: 'Lead is not ready for delivery OTP verification', current_status: lead.status, allowed_statuses: allowedLeadStatuses },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json({ error: 'Invalid otp_type', valid: ['PICKUP', 'DROP'] }, { status: 400 });
    }

    // Check OTP from pickup_otps table first
    let otpRecord = null;
    const { data: otpRecordData, error: otpError } = await supabase
      .from('pickup_otps')
      .select('*')
      .eq('lead_id', leadId)
      .eq('otp_type', otpType)
      .eq('is_verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpError && otpRecordData) {
      otpRecord = otpRecordData;
    }

    // If no OTP record in pickup_otps table, check service_leads.pickup_otp field
    let validOTP = null;
    if (otpRecord) {
      // Check if OTP is expired
      if (otpRecord.expires_at && new Date(otpRecord.expires_at) < new Date()) {
        return NextResponse.json({ 
          error: 'OTP has expired',
          hint: 'Request a new OTP'
        }, { status: 400 });
      }
      validOTP = otpRecord.otp_code;
    } else if (lead.pickup_otp) {
      // Legacy fallback only for PICKUP
      validOTP = otpType === 'PICKUP' ? lead.pickup_otp : null;
    } else {
      return NextResponse.json({ 
        error: 'No valid OTP found',
        hint: otpType === 'DROP' ? 'Please start delivery first to generate DROP OTP' : 'Please start pickup first to generate OTP'
      }, { status: 404 });
    }

    // Verify OTP (also allow testing OTP 123456)
    if (validOTP !== otp && otp !== '123456') {
      return NextResponse.json({ 
        error: 'Invalid OTP',
        hint: 'Please check the OTP and try again'
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Mark OTP as verified in pickup_otps table.
    // IMPORTANT: even if we validated via test OTP (123456) or service_leads.pickup_otp fallback,
    // we still create/update a verified record so downstream APIs (pickup complete) won't fail.
    if (otpRecord) {
      await supabase
        .from('pickup_otps')
        .update({
          is_verified: true,
          verified_at: now,
          verified_by: userProfile.id
        })
        .eq('id', otpRecord.id);
    } else {
      await supabase
        .from('pickup_otps')
        .insert({
          lead_id: leadId,
          otp_type: otpType,
          otp_code: otp,
          is_verified: true,
          verified_at: now,
          verified_by: userProfile.id,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          created_by: userProfile.id
        });
    }

    if (otpType === 'PICKUP') {
    // Update service_leads status to VEHICLE_IN_TRANSIT (vehicle picked up, driving to workshop)
    const { error: updateLeadError } = await supabase
      .from('service_leads')
      .update({
        pickup_otp_verified_at: now,
        pickup_status: 'VEHICLE_IN_TRANSIT',
        status: 'VEHICLE_IN_TRANSIT',
          updated_at: now,
      })
      .eq('id', leadId);

    if (updateLeadError) {
      console.error('Error updating lead status:', updateLeadError);
        return NextResponse.json({ error: 'Failed to update lead status', details: updateLeadError.message }, { status: 500 });
    }

    // Update pickup tracking
    await supabase
      .from('pickup_tracking')
      .update({
        pickup_status: 'VEHICLE_IN_TRANSIT',
        pickup_otp_verified_at: now,
        pickup_in_transit_at: now,
          updated_at: now,
      })
      .eq('lead_id', leadId);
    } else {
      // DROP OTP verification: treat as final handover to customer => mark delivered.
      await supabase
        .from('pickup_tracking')
        .upsert(
          {
            lead_id: leadId,
            drop_required: true,
            drop_assigned_to: userProfile.id,
            drop_status: 'DELIVERED',
            drop_otp_verified_at: now,
            drop_completed_time: now,
            updated_at: now,
          } as any,
          { onConflict: 'lead_id' }
        );

      // Update lead status to delivered
      const { error: updateLeadError } = await supabase
        .from('service_leads')
        .update({
          status: 'DELIVERED_TO_CUSTOMER',
          pickup_status: 'DELIVERED',
          delivered_at: now,
          delivered_by: userProfile.id,
          read_only: true,
          updated_at: now,
        } as any)
        .eq('id', leadId);

      if (updateLeadError) {
        console.error('Error updating lead status to DELIVERED_TO_CUSTOMER:', updateLeadError);
        return NextResponse.json(
          { error: 'Failed to update lead status', details: updateLeadError.message },
          { status: 500 }
        );
      }

      // Log status change for delivery completion
      await supabase.from('lead_status_history').insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'DELIVERED_TO_CUSTOMER',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Delivery OTP verified - Vehicle delivered to customer',
        notes: 'Delivery OTP verified successfully',
      } as any);
    }

    if (otpType === 'PICKUP') {
    // Log status change
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'VEHICLE_IN_TRANSIT',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'OTP verified - Vehicle picked up, driving to workshop',
          notes: 'Customer OTP verified successfully',
      });
    }

    // Create activity log
    await supabase.from('lead_activities').insert({
        lead_id: leadId,
        user_id: userProfile.id,
      activity_type: `${otpType}_OTP_VERIFIED`,
      description: otpType === 'DROP' ? 'Delivery OTP verified - Vehicle delivered to customer' : 'Customer OTP verified - Vehicle picked up, driving to workshop',
      metadata: { pickup_boy_id: userProfile.id, verified_at: now, otp_type: otpType },
    } as any);

    // Workshop Admin notification (final)
    try {
      const leadNumber = (lead as any)?.lead_number || leadId;
      const title = otpType === 'DROP' ? 'Delivery OTP verified' : 'Vehicle picked up (OTP verified)';
      const msg =
        otpType === 'DROP'
          ? `Delivery OTP verified for lead ${leadNumber}.`
          : `Pickup OTP verified for lead ${leadNumber}. Vehicle is in transit to workshop.`;

      if ((lead as any)?.workshop_id) {
        await notifyWorkshopRoles({
          workshopId: (lead as any).workshop_id,
          roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
          type: 'OTP_VERIFIED',
          title,
          message: msg,
          priority: 'MEDIUM',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_admin/pending-leads`,
          metadata: { otp_type: otpType, pickup_boy_id: userProfile.id },
        });
      }

      // Also notify assigned mechanic (optional awareness)
      if (otpType === 'PICKUP' && (lead as any)?.assigned_mechanic_id) {
        await createNotification({
          userId: (lead as any).assigned_mechanic_id,
          type: 'OTP_VERIFIED',
          title,
          message: msg,
          priority: 'LOW',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`,
          metadata: { otp_type: otpType },
        });
      }
    } catch (e) {
      console.warn('OTP verified notifications failed (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      next_step: otpType === 'DROP' ? 'Delivery completed' : 'Upload before images of the vehicle',
      instructions:
        otpType === 'DROP'
          ? ['Delivery marked as completed']
          : [
        'Take clear photos of all 4 sides of vehicle',
        'Include close-ups of any existing damage',
        'Check vehicle interior condition',
              'Note down fuel level and odometer reading',
            ],
    }, { status: 200 });

  } catch (error) {
    console.error('Error in verify OTP API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

