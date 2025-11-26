/**
 * Log Telecaller Call API
 * Purpose: Log telecaller call interactions
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is telecaller
    if (userProfile.role !== 'telecaller' && userProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: Telecaller only' }, { status: 403 });
    }

    const body = await request.json();
    const {
      lead_id,
      call_type, // INBOUND, OUTBOUND
      call_status, // ANSWERED, MISSED, BUSY, NO_ANSWER, REJECTED
      call_duration,
      outcome, // LEAD_CREATED, FOLLOW_UP_SCHEDULED, NOT_INTERESTED, etc.
      customer_response,
      notes,
      next_action,
      next_action_time,
      phone_number,
      call_recording_url,
    } = body;

    if (!lead_id || !call_type || !call_status) {
      return NextResponse.json({
        error: 'Missing required fields: lead_id, call_type, call_status',
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Create call log
    const { data: callLog, error: callError } = await supabase
      .from('telecaller_call_logs')
      .insert({
        lead_id: lead_id,
        telecaller_id: userProfile.id,
        call_type: call_type,
        call_status: call_status,
        call_duration: call_duration,
        outcome: outcome,
        customer_response: customer_response,
        notes: notes,
        next_action: next_action,
        next_action_time: next_action_time,
        phone_number: phone_number,
        call_recording_url: call_recording_url,
        created_at: now,
      })
      .select()
      .single();

    if (callError) {
      console.error('Error logging call:', callError);
      return NextResponse.json({ error: 'Failed to log call' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Call logged successfully',
      call_log: callLog,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in log call API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

