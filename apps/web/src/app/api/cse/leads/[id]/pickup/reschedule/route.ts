/**
 * CSE Reschedule Pickup API
 * POST /api/cse/leads/[id]/pickup/reschedule
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { scheduled_pickup_date, scheduled_pickup_time, pickup_address, reason } = body;

    if (!scheduled_pickup_date) {
      return NextResponse.json({ error: 'scheduled_pickup_date is required' }, { status: 400 });
    }

    // Update lead
    const updates: any = {
      scheduled_pickup_date,
      scheduled_pickup_time: scheduled_pickup_time || null,
      pickup_address: pickup_address || null,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update(updates)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error rescheduling pickup:', updateError);
      return NextResponse.json({ error: 'Failed to reschedule pickup' }, { status: 500 });
    }

    // Log activity
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'PICKUP_RESCHEDULED',
      description: `Pickup rescheduled to ${scheduled_pickup_date}${scheduled_pickup_time ? ` at ${scheduled_pickup_time}` : ''}`,
      metadata: { reason, scheduled_pickup_date, scheduled_pickup_time },
    });

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      message: 'Pickup rescheduled successfully',
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in CSE reschedule pickup API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

