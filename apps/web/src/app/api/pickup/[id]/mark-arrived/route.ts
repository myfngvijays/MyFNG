import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/pickup/[id]/mark-arrived
 * Mark vehicle arrived at workshop
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

    // Update pickup tracking
    const { data: updated, error: updateError } = await supabase
      .from('pickup_tracking')
      .update({
        pickup_status: 'ARRIVED_AT_WORKSHOP',
        pickup_arrival_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', leadId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to mark as arrived', details: updateError.message }, { status: 500 });
    }

    // Log location
    if (latitude && longitude) {
      await supabase.from('pickup_location_tracking').insert({
        lead_id: leadId,
        pickup_boy_id: user.id,
        latitude,
        longitude,
        status: 'AT_WORKSHOP',
      });
    }

    // Update lead status to IN_PROGRESS
    await supabase
      .from('service_leads')
      .update({ status: 'IN_PROGRESS', updated_at: new Date().toISOString() })
      .eq('id', leadId);

    // Create activity log
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'ARRIVED_AT_WORKSHOP',
      description: 'Vehicle arrived at workshop',
      metadata: { notes, latitude, longitude },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Vehicle marked as arrived at workshop',
    });
  } catch (error: any) {
    console.error('Error marking as arrived:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

