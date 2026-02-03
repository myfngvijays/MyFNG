import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { notifyPickupBoy, notifyWorkshopRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/pickup/[id]/mark-picked
 * Mark vehicle as picked
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
    const { notes, latitude, longitude } = body;

    // Observation gating (per-lead). Backwards compatible if column not yet migrated.
    try {
      let obsRequired = false;
      let obsText: string | null = null;
      const { data: leadObs, error: leadObsError } = await supabase
        .from('service_leads')
        .select('id, pickup_observation, pickup_observation_required')
        .eq('id', leadId)
        .single();

      if (!leadObsError && leadObs) {
        obsRequired = !!(leadObs as any).pickup_observation_required;
        obsText = (leadObs as any).pickup_observation || null;
      }

      if (obsRequired && !String(obsText || '').trim()) {
        return NextResponse.json(
          { error: 'Observation report pending', hint: 'Submit observation report to continue' },
          { status: 400 }
        );
      }
    } catch {
      // If column doesn't exist yet, treat as not required.
    }

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

    // Update pickup tracking - Mark as picked and start driving to workshop
    const { data: updated, error: updateError } = await supabase
      .from('pickup_tracking')
      .update({
        pickup_status: 'VEHICLE_IN_TRANSIT',      // ✨ NEW: Vehicle in transit to workshop
        pickup_picked_time: new Date().toISOString(),
        pickup_in_transit_at: new Date().toISOString(), // ✨ NEW: When started driving to workshop
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

    // Notifications (final)
    try {
      const { data: fullLead } = await supabase
        .from('service_leads')
        .select('id, lead_number, workshop_id')
        .eq('id', leadId)
        .maybeSingle();

      const leadNumber = (fullLead as any)?.lead_number || leadId;

      await notifyPickupBoy({
        pickupBoyId: user.id,
        type: 'PICKUP_COMPLETED',
        title: 'Pickup completed',
        message: `Lead ${leadNumber}: Pickup completed. Proceed to workshop and mark vehicle arrived.`,
        priority: 'MEDIUM',
        leadId,
        leadNumber,
        metadata: { kind: 'PICKUP_COMPLETED' },
      });

      if ((fullLead as any)?.workshop_id) {
        await notifyWorkshopRoles({
          workshopId: (fullLead as any).workshop_id,
          roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
          type: 'PICKUP_COMPLETED',
          title: 'Vehicle picked up',
          message: `Lead ${leadNumber}: Vehicle picked up by pickup boy. In transit to workshop.`,
          priority: 'LOW',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_supervisor/pickup-delivery`,
          metadata: { kind: 'PICKUP_COMPLETED' },
        });
      }
    } catch (e) {
      console.warn('Pickup completed notifications failed (non-blocking):', e);
    }

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

