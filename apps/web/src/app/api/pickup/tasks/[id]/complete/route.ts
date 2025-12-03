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

    // Verify pickup status is IN_TRANSIT
    if (lead.pickup_status !== 'IN_TRANSIT') {
      return NextResponse.json({ 
        error: 'Pickup must be in IN_TRANSIT status',
        current_status: lead.pickup_status
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

    // Check if before images are uploaded
    const { count: beforeImages } = await supabase
      .from('lead_media')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .eq('category', 'BEFORE');

    if (!beforeImages || beforeImages < 1) {
      return NextResponse.json({ 
        error: 'Before images are required',
        hint: 'Upload at least 1 before image'
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update lead status to DELIVERED (vehicle at workshop)
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        pickup_status: 'DELIVERED',
        status: 'DELIVERED',
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

    // Update pickup tracking
    await supabase
      .from('pickup_tracking')
      .update({
        pickup_status: 'DELIVERED',
        pickup_picked_time: now,
        pickup_arrival_time: now,
        pickup_notes: notes || 'Vehicle delivered to workshop',
        updated_at: now
      })
      .eq('lead_id', leadId);

    // Log status change
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'DELIVERED',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Vehicle delivered to workshop by pickup boy',
        notes: notes || 'Delivery completed successfully'
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'PICKUP_COMPLETED',
        description: 'Vehicle delivered to workshop',
        old_status: lead.status,
        new_status: 'DELIVERED',
        metadata: {
          pickup_boy_id: userProfile.id,
          delivered_at: now,
          odometer_reading: odometer_reading,
          fuel_level: fuel_level,
          notes: notes,
          before_images_count: beforeImages
        }
      });

    // TODO: Send notification to mechanic (vehicle ready)
    // TODO: Send notification to workshop admin
    // TODO: Send notification to customer (vehicle received)

    return NextResponse.json({
      success: true,
      message: 'Pickup completed successfully - Vehicle delivered to workshop',
      lead: updatedLead,
      next_step: 'Mechanic will start working on the vehicle',
      delivery_summary: {
        delivered_at: now,
        odometer_reading: odometer_reading,
        fuel_level: fuel_level,
        before_images_count: beforeImages
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in complete pickup API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

