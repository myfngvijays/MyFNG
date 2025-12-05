import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/pickup/[id]/start
 * Start pickup process
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

    // Check if user is assigned
    if (tracking.pickup_assigned_to !== user.id) {
      return NextResponse.json({ error: 'Not assigned to this pickup' }, { status: 403 });
    }

    // Update pickup tracking - Start navigation (ON_THE_WAY status)
    const { data: updated, error: updateError } = await supabase
      .from('pickup_tracking')
      .update({
        pickup_status: 'ON_THE_WAY',              // ✨ NEW: Status when navigation started
        pickup_start_time: new Date().toISOString(),
        pickup_on_the_way_at: new Date().toISOString(), // ✨ NEW: Timestamp for ON_THE_WAY status
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', leadId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to start pickup', details: updateError.message }, { status: 500 });
    }

    // Log location
    if (latitude && longitude) {
      await supabase.from('pickup_location_tracking').insert({
        lead_id: leadId,
        pickup_boy_id: user.id,
        latitude,
        longitude,
        status: 'MOVING_TO_PICKUP',
      });
    }

    // Create activity log
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'PICKUP_STARTED',
      description: 'Pickup boy started pickup process',
      metadata: { latitude, longitude },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Pickup started successfully',
    });
  } catch (error: any) {
    console.error('Error starting pickup:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

