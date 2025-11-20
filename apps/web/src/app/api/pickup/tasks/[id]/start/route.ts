import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role, workshop_id, name')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is pickup boy
    if (userProfile.role !== 'workshop_pickup_boy') {
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
      return NextResponse.json({ error: 'Pickup task not found' }, { status: 404 });
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

    // Verify pickup status
    if (lead.pickup_status !== 'ASSIGNED' && lead.pickup_status !== 'PENDING') {
      return NextResponse.json({ 
        error: 'Pickup task cannot be started in current status',
        current_status: lead.pickup_status
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Generate OTP for customer verification (6-digit)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes

    // Update lead pickup status to IN_TRANSIT
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        pickup_status: 'IN_TRANSIT',
        pickup_otp: otp,
        status: 'IN_TRANSIT',
        updated_at: now
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error starting pickup:', updateError);
      return NextResponse.json({ error: 'Failed to start pickup' }, { status: 500 });
    }

    // Create/Update pickup tracking record
    await supabase
      .from('pickup_tracking')
      .upsert({
        lead_id: leadId,
        pickup_required: true,
        pickup_status: 'IN_TRANSIT',
        pickup_assigned_to: userProfile.id,
        pickup_start_time: now,
        pickup_otp: otp,
        pickup_address: lead.pickup_address || lead.customer_address,
        pickup_latitude: lead.pickup_latitude || lead.customer_lat,
        pickup_longitude: lead.pickup_longitude || lead.customer_lng,
        updated_at: now
      }, {
        onConflict: 'lead_id'
      });

    // Create OTP record
    await supabase
      .from('pickup_otps')
      .insert({
        lead_id: leadId,
        otp_type: 'PICKUP',
        otp_code: otp,
        expires_at: otpExpiresAt,
        is_verified: false
      });

    // Log status change
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'IN_TRANSIT',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Pickup boy started vehicle pickup',
        notes: `Started by ${userProfile.name}`
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'PICKUP_STARTED',
        description: 'Pickup boy started vehicle pickup',
        old_status: lead.status,
        new_status: 'IN_TRANSIT',
        metadata: {
          pickup_boy_id: userProfile.id,
          pickup_boy_name: userProfile.name,
          started_at: now,
          otp_generated: true
        }
      });

    // TODO: Send OTP to customer via SMS/WhatsApp
    // TODO: Send notification to workshop admin
    // TODO: Send notification to mechanic

    return NextResponse.json({
      success: true,
      message: 'Pickup task started successfully',
      lead: updatedLead,
      otp: otp, // In production, don't send OTP in response
      customer: {
        name: lead.customer_name,
        phone: lead.customer_phone,
        address: lead.pickup_address || lead.customer_address
      },
      instructions: [
        'Navigate to customer location',
        'Verify customer identity',
        'Ask customer for OTP',
        'Upload before images of vehicle',
        'Mark vehicle as picked up'
      ]
    }, { status: 200 });

  } catch (error) {
    console.error('Error in start pickup API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

