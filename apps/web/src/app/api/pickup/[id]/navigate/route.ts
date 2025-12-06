import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pickup/[id]/navigate
 * Update lead status to ON_THE_WAY when pickup boy clicks Navigate
 */
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
    const body = await request.json();
    const { latitude, longitude } = body || {};

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

    // Prevent overwriting WORK_COMPLETED or later statuses
    const protectedStatuses = ['WORK_COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'];
    if (protectedStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: 'Cannot update status - work already completed',
        current_status: lead.status,
        message: 'Mechanic has already completed the work. Status cannot be changed.'
      }, { status: 400 });
    }

    // Note: Allow navigation even if pickup_required is not explicitly set
    // This allows flexibility for pickup boys to navigate to any assigned task

    const now = new Date().toISOString();

    // Auto-generate OTP when navigate is clicked (testing mode: 123456)
    const otp = '123456';

    // Update service_leads status to ON_THE_WAY and generate OTP
    const { error: updateLeadError } = await supabase
      .from('service_leads')
      .update({
        status: 'ON_THE_WAY',
        pickup_status: 'ON_THE_WAY',
        pickup_otp: otp, // Auto-generate OTP
        updated_at: now
      })
      .eq('id', leadId);

    if (updateLeadError) {
      console.error('Error updating lead status:', updateLeadError);
      // Check if it's an enum value error
      if (updateLeadError.message && updateLeadError.message.includes('ON_THE_WAY')) {
        return NextResponse.json({ 
          error: 'ON_THE_WAY status not found in database enum',
          details: 'Please run database migration: database/81_add_on_the_way_status.sql',
          hint: updateLeadError.message
        }, { status: 500 });
      }
      return NextResponse.json({ 
        error: 'Failed to update lead status', 
        details: updateLeadError.message,
        code: updateLeadError.code
      }, { status: 500 });
    }

    // Update pickup_tracking if exists
    const { data: tracking } = await supabase
      .from('pickup_tracking')
      .select('id')
      .eq('lead_id', leadId)
      .maybeSingle();

    if (tracking) {
      await supabase
        .from('pickup_tracking')
        .update({
          pickup_status: 'ON_THE_WAY',
          pickup_on_the_way_at: now,
          updated_at: now
        })
        .eq('lead_id', leadId);
    } else {
      // Create pickup_tracking record if it doesn't exist
      await supabase
        .from('pickup_tracking')
        .insert({
          lead_id: leadId,
          pickup_required: true,
          pickup_status: 'ON_THE_WAY',
          pickup_assigned_to: userProfile.id,
          pickup_on_the_way_at: now,
          pickup_address: lead.pickup_address || lead.customer_address,
          pickup_latitude: lead.pickup_latitude || lead.customer_lat,
          pickup_longitude: lead.pickup_longitude || lead.customer_lng,
          updated_at: now
        });
    }

    // Log location if provided
    if (latitude && longitude) {
      await supabase
        .from('pickup_location_tracking')
        .insert({
          lead_id: leadId,
          pickup_boy_id: userProfile.id,
          latitude,
          longitude,
          status: 'MOVING_TO_PICKUP',
          created_at: now
        });
    }

    // Log status change
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'ON_THE_WAY',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Pickup boy started navigation',
        notes: 'Navigate button clicked'
      });

    // Create OTP record in pickup_otps table
    await supabase
      .from('pickup_otps')
      .insert({
        lead_id: leadId,
        otp_code: otp,
        otp_type: 'PICKUP',
        is_verified: false,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes expiry
        created_by: userProfile.id
      });

    // Create lead event for OTP generation
    try {
      await supabase.from('lead_events').insert({
        lead_id: leadId,
        event_type: 'PICKUP_STARTED',
        event_description: `Pickup boy started navigation. OTP generated: ${otp} (testing mode)`,
        created_by: userProfile.id,
      });
    } catch (eventError) {
      console.error('Error creating lead event (non-critical):', eventError);
    }

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'PICKUP_NAVIGATION_STARTED',
        description: 'Pickup boy started navigation to pickup location. OTP generated.',
        old_status: lead.status,
        new_status: 'ON_THE_WAY',
        metadata: { 
          latitude, 
          longitude,
          pickup_address: lead.pickup_address || lead.customer_address,
          otp_generated: true,
          otp: otp
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Status updated to ON_THE_WAY. OTP generated.',
      status: 'ON_THE_WAY',
      otp: otp // Return OTP for testing
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in navigate API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

