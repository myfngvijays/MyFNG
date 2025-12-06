import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
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
    const { otp } = body;

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

    // Prevent overwriting COMPLETED or later statuses
    const protectedStatuses = ['COMPLETED', 'WORK_COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'];
    if (protectedStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: 'Cannot update status - work already completed',
        current_status: lead.status,
        message: 'Mechanic has already completed the work. Status cannot be changed.'
      }, { status: 400 });
    }

    // Check OTP from pickup_otps table first
    let otpRecord = null;
    const { data: otpRecordData, error: otpError } = await supabase
      .from('pickup_otps')
      .select('*')
      .eq('lead_id', leadId)
      .eq('otp_type', 'PICKUP')
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
      // Use OTP from service_leads table (testing mode or direct storage)
      validOTP = lead.pickup_otp;
    } else {
      return NextResponse.json({ 
        error: 'No valid OTP found',
        hint: 'Please start pickup first to generate OTP'
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

    // Mark OTP as verified in pickup_otps table if record exists
    if (otpRecord) {
      await supabase
        .from('pickup_otps')
        .update({
          is_verified: true,
          verified_at: now,
          verified_by: userProfile.id
        })
        .eq('id', otpRecord.id);
    }

    // Update service_leads status to VEHICLE_IN_TRANSIT (vehicle picked up, driving to workshop)
    const { error: updateLeadError } = await supabase
      .from('service_leads')
      .update({
        pickup_otp_verified_at: now,
        pickup_status: 'VEHICLE_IN_TRANSIT',
        status: 'VEHICLE_IN_TRANSIT',
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

    // Update pickup tracking
    await supabase
      .from('pickup_tracking')
      .update({
        pickup_status: 'VEHICLE_IN_TRANSIT',
        pickup_otp_verified_at: now,
        pickup_in_transit_at: now,
        updated_at: now
      })
      .eq('lead_id', leadId);

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
        notes: 'Customer OTP verified successfully'
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'OTP_VERIFIED',
        description: 'Customer OTP verified - Vehicle picked up, driving to workshop',
        old_status: lead.status,
        new_status: 'VEHICLE_IN_TRANSIT',
        metadata: {
          pickup_boy_id: userProfile.id,
          verified_at: now,
          otp_type: 'PICKUP'
        }
      });

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      next_step: 'Upload before images of the vehicle',
      instructions: [
        'Take clear photos of all 4 sides of vehicle',
        'Include close-ups of any existing damage',
        'Check vehicle interior condition',
        'Note down fuel level and odometer reading'
      ]
    }, { status: 200 });

  } catch (error) {
    console.error('Error in verify OTP API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

