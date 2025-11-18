import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/pickup/[id]/mark-picked
 * Mark vehicle as picked
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
    const { notes, latitude, longitude } = body;

    // Check if minimum photos are uploaded
    const { count: photoCount, error: photoCountError } = await supabase
      .from('vehicle_condition_photos')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .like('photo_type', 'PICKUP_%');

    if (photoCountError) {
      return NextResponse.json({ error: 'Failed to check photos' }, { status: 500 });
    }

    if ((photoCount || 0) < 4) {
      return NextResponse.json({ 
        error: 'Minimum 4 pickup photos required',
        required_photos: ['PICKUP_FRONT', 'PICKUP_LEFT', 'PICKUP_RIGHT', 'PICKUP_INTERIOR']
      }, { status: 400 });
    }

    // Update pickup tracking
    const { data: updated, error: updateError } = await supabase
      .from('pickup_tracking')
      .update({
        pickup_status: 'PICKED',
        pickup_picked_time: new Date().toISOString(),
        pickup_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', leadId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to mark as picked', details: updateError.message }, { status: 500 });
    }

    // Log location
    if (latitude && longitude) {
      await supabase.from('pickup_location_tracking').insert({
        lead_id: leadId,
        pickup_boy_id: user.id,
        latitude,
        longitude,
        status: 'AT_PICKUP',
      });
    }

    // Create activity log
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'VEHICLE_PICKED',
      description: 'Vehicle picked up by pickup boy',
      metadata: { notes, latitude, longitude },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Vehicle marked as picked successfully',
    });
  } catch (error: any) {
    console.error('Error marking as picked:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

