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

    // Get OTP record
    const { data: otpRecord, error: otpError } = await supabase
      .from('pickup_otps')
      .select('*')
      .eq('lead_id', leadId)
      .eq('otp_type', 'PICKUP')
      .eq('is_verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRecord) {
      return NextResponse.json({ error: 'No valid OTP found' }, { status: 404 });
    }

    // Check if OTP is expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      return NextResponse.json({ 
        error: 'OTP has expired',
        hint: 'Request a new OTP'
      }, { status: 400 });
    }

    // Verify OTP
    if (otpRecord.otp_code !== otp) {
      return NextResponse.json({ 
        error: 'Invalid OTP',
        hint: 'Please check the OTP and try again'
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Mark OTP as verified
    await supabase
      .from('pickup_otps')
      .update({
        is_verified: true,
        verified_at: now,
        verified_by: userProfile.id
      })
      .eq('id', otpRecord.id);

    // Update pickup tracking
    await supabase
      .from('pickup_tracking')
      .update({
        pickup_otp_verified_at: now,
        updated_at: now
      })
      .eq('lead_id', leadId);

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'OTP_VERIFIED',
        description: 'Customer OTP verified successfully',
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

