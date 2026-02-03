import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/pickup/[id]/arrive-at-customer
 * Mark arrived at customer location (for pickup)
 */
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const params = await paramsPromise;
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

    // Update pickup tracking - Arrived at customer location
    const { data: updated, error: updateError } = await supabase
      .from('pickup_tracking')
      .update({
        pickup_status: 'ARRIVED',                 // ✨ NEW: Arrived at customer location
        pickup_arrived_at: new Date().toISOString(), // ✨ NEW: Timestamp for ARRIVED status
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
        status: 'AT_PICKUP',
      });
    }

    // Create activity log
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'ARRIVED_AT_CUSTOMER',
      description: 'Pickup boy arrived at customer location',
      metadata: { latitude, longitude },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Arrived at customer location',
    });
  } catch (error: any) {
    console.error('Error marking as arrived at customer:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

