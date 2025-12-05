import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/pickup/[id]/arrive-at-customer-delivery
 * Mark arrived at customer location (for delivery)
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

    // Update drop tracking - Arrived at customer location for delivery
    const { data: updated, error: updateError } = await supabase
      .from('pickup_tracking')
      .update({
        drop_status: 'ARRIVED_AT_CUSTOMER',       // ✨ NEW: Arrived at customer location for delivery
        drop_arrived_at: new Date().toISOString(), // ✨ NEW: Timestamp for ARRIVED_AT_CUSTOMER status
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
        status: 'AT_DROP',
      });
    }

    // Create activity log
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'ARRIVED_AT_CUSTOMER_DELIVERY',
      description: 'Pickup boy arrived at customer location for delivery',
      metadata: { latitude, longitude },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Arrived at customer location for delivery',
    });
  } catch (error: any) {
    console.error('Error marking as arrived at customer (delivery):', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

