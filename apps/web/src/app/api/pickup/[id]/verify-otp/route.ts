import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/pickup/[id]/verify-otp
 * Verify pickup OTP
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const leadId = params.id;
    const body = await request.json();
    const { otp_code, otp_type } = body;

    if (!otp_code || !otp_type) {
      return NextResponse.json({ error: 'OTP code and type are required' }, { status: 400 });
    }

    // Verify OTP using database function
    const { data: isValid, error: verifyError } = await supabase
      .rpc('verify_pickup_otp', {
        p_lead_id: leadId,
        p_otp_type: otp_type,
        p_otp_code: otp_code,
        p_verified_by: user.id,
      });

    if (verifyError) {
      return NextResponse.json({ error: 'Failed to verify OTP', details: verifyError.message }, { status: 500 });
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
    }

    // Update pickup tracking based on OTP type
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (otp_type === 'PICKUP') {
      updateData.pickup_status = 'OTP_VERIFIED';
      updateData.pickup_otp_verified_at = new Date().toISOString();
    } else if (otp_type === 'DROP') {
      updateData.drop_status = 'ASSIGNED';
      updateData.drop_otp_verified_at = new Date().toISOString();
    }

    const { data: updated, error: updateError } = await supabase
      .from('pickup_tracking')
      .update(updateData)
      .eq('lead_id', leadId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update tracking', details: updateError.message }, { status: 500 });
    }

    // Create activity log
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: `${otp_type}_OTP_VERIFIED`,
      description: `${otp_type} OTP verified successfully`,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'OTP verified successfully',
    });
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

