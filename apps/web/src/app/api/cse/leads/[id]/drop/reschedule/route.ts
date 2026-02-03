/**
 * CSE Reschedule Drop API
 * POST /api/cse/leads/[id]/drop/reschedule
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    const leadId = params.id;
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify CSE role
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    if (roleCode !== 'CUSTOMER_SERVICE_EXECUTIVE' && roleCode !== 'CSE') {
      return NextResponse.json({ error: 'Forbidden: CSE role required' }, { status: 403 });
    }

    const body = await request.json();
    // Backward-compatible payload: older UI sends scheduled_delivery_date/time
    const {
      scheduled_delivery_date,
      scheduled_delivery_time,
      delivery_address,
      reason,
      drop_date,
      drop_time_slot,
    } = body;

    const dropDate = drop_date || scheduled_delivery_date;
    const dropTimeSlot = drop_time_slot || scheduled_delivery_time;

    if (!dropDate) {
      return NextResponse.json({ error: 'scheduled_delivery_date is required' }, { status: 400 });
    }

    // Upsert pickup_tracking for drop scheduling (canonical place for drop scheduling fields)
    const { data: updatedTracking, error: trackingError } = await supabase
      .from('pickup_tracking')
      .upsert(
        {
          lead_id: leadId,
          drop_address: delivery_address || null,
          drop_time_slot: dropTimeSlot || null,
          // Your pickup_tracking schema does NOT have drop_time_window_start/end.
          // Best-effort: store chosen date into drop_assigned_at so UI can display something.
          drop_assigned_at: new Date(dropDate).toISOString(),
      updated_at: new Date().toISOString(),
        },
        { onConflict: 'lead_id' }
      )
      .select()
      .single();

    if (trackingError) {
      console.error('Error rescheduling drop (pickup_tracking):', trackingError);
      return NextResponse.json({ error: 'Failed to reschedule drop' }, { status: 500 });
    }

    // Log activity
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'DROP_RESCHEDULED',
      description: `Drop rescheduled to ${dropDate}${dropTimeSlot ? ` at ${dropTimeSlot}` : ''}`,
      metadata: { reason, dropDate, dropTimeSlot },
    });

    return NextResponse.json({
      success: true,
      pickup_tracking: updatedTracking,
      message: 'Drop rescheduled successfully',
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in CSE reschedule drop API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

