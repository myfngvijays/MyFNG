/**
 * Telecaller Follow-ups API
 * Purpose: Manage telecaller follow-up schedules
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const lead_id = searchParams.get('lead_id');

    let query = supabase
      .from('telecaller_follow_ups')
      .select(`
        *,
        lead:service_leads(id, lead_number, customer_name, customer_phone),
        telecaller:users_login!telecaller_id(id, full_name),
        completed_by_user:users_login!completed_by(id, full_name)
      `)
      .eq('status', status)
      .order('scheduled_time', { ascending: true });

    if (lead_id) {
      query = query.eq('lead_id', lead_id);
    }

    // If telecaller, only show their follow-ups
    if (userProfile.role === 'telecaller') {
      query = query.eq('telecaller_id', userProfile.id);
    }

    const { data: followUps, error: followUpsError } = await query;

    if (followUpsError) {
      console.error('Error fetching follow-ups:', followUpsError);
      return NextResponse.json({ error: 'Failed to fetch follow-ups' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      follow_ups: followUps || [],
      total: followUps?.length || 0,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get follow-ups API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Create Follow-up
 */
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

    const body = await request.json();
    const {
      lead_id,
      follow_up_type, // CALLBACK, REMINDER, FOLLOW_UP
      scheduled_time,
      priority,
      reason,
      context_notes,
    } = body;

    if (!lead_id || !follow_up_type || !scheduled_time || !reason) {
      return NextResponse.json({
        error: 'Missing required fields: lead_id, follow_up_type, scheduled_time, reason',
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Create follow-up
    const { data: followUp, error: followUpError } = await supabase
      .from('telecaller_follow_ups')
      .insert({
        lead_id: lead_id,
        telecaller_id: userProfile.role === 'telecaller' ? userProfile.id : body.telecaller_id,
        follow_up_type: follow_up_type,
        scheduled_time: scheduled_time,
        priority: priority || 'NORMAL',
        reason: reason,
        context_notes: context_notes,
        status: 'PENDING',
        reminder_sent: false,
        created_at: now,
      })
      .select()
      .single();

    if (followUpError) {
      console.error('Error creating follow-up:', followUpError);
      return NextResponse.json({ error: 'Failed to create follow-up' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Follow-up scheduled successfully',
      follow_up: followUp,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in create follow-up API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

