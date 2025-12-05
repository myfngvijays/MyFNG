import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/pickup/[id]/drop/start
 * Start drop process
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
    const { latitude, longitude } = body;

    // Get pickup tracking
    const { data: tracking, error: trackingError } = await supabase
      .from('pickup_tracking')
      .select('*')
      .eq('lead_id', leadId)
      .single();

    if (trackingError || !tracking) {
      return NextResponse.json({ error: 'Pickup tracking not found' }, { status: 404 });
    }

    // Check if drop is required
    if (!tracking.drop_required) {
      return NextResponse.json({ error: 'Drop not required for this lead' }, { status: 400 });
    }

    // Check if user is assigned
    if (tracking.drop_assigned_to !== user.id) {
      return NextResponse.json({ error: 'Not assigned to this drop' }, { status: 403 });
    }

    // Update drop tracking - Start delivery (OUT_FOR_DELIVERY status)
    const { data: updated, error: updateError } = await supabase
      .from('pickup_tracking')
      .update({
        drop_status: 'OUT_FOR_DELIVERY',          // ✨ NEW: Out for delivery to customer
        drop_start_time: new Date().toISOString(),
        drop_out_for_delivery_at: new Date().toISOString(), // ✨ NEW: When status changed to OUT_FOR_DELIVERY
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', leadId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to start drop', details: updateError.message }, { status: 500 });
    }

    // Log location
    if (latitude && longitude) {
      await supabase.from('pickup_location_tracking').insert({
        lead_id: leadId,
        pickup_boy_id: user.id,
        latitude,
        longitude,
        status: 'MOVING_TO_DROP',
      });
    }

    // Create activity log
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'DROP_STARTED',
      description: 'Drop process started',
      metadata: { latitude, longitude },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Drop started successfully',
    });
  } catch (error: any) {
    console.error('Error starting drop:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

