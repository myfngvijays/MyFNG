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

    // Fetch lead for read-only protection + status validation
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, status, read_only')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.read_only) {
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
    }

    // Validate assignment from pickup_tracking
    const { data: tracking, error: trackingError } = await supabase
      .from('pickup_tracking')
      .select('drop_required, drop_assigned_to, drop_status')
      .eq('lead_id', leadId)
      .single();

    if (trackingError || !tracking) {
      return NextResponse.json({ error: 'Pickup tracking not found' }, { status: 404 });
    }

    if (!tracking.drop_required) {
      return NextResponse.json({ error: 'Drop not required for this lead' }, { status: 400 });
    }

    if (tracking.drop_assigned_to !== user.id) {
      return NextResponse.json({ error: 'Not assigned to this drop' }, { status: 403 });
    }

    // Ensure lead is ready for delivery
    const allowedLeadStatuses = ['READY_FOR_DELIVERY', 'COD_PENDING'];
    if (!allowedLeadStatuses.includes(lead.status)) {
      return NextResponse.json({
        error: 'Lead is not ready for delivery',
        current_status: lead.status,
        allowed_statuses: allowedLeadStatuses,
      }, { status: 400 });
    }

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

