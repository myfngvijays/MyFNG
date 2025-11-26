/**
 * Log Supervisor Action API
 * Purpose: Track all supervisor actions for audit trail
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

    // Verify user is supervisor
    if (userProfile.role !== 'supervisor' && userProfile.role !== 'super_admin' && userProfile.role !== 'sub_admin') {
      return NextResponse.json({ error: 'Forbidden: Supervisor only' }, { status: 403 });
    }

    const body = await request.json();
    const {
      lead_id,
      action_type, // QC_APPROVED, QC_REJECTED, EXTRA_WORK_APPROVED, etc.
      action_data,
      notes,
    } = body;

    if (!lead_id || !action_type) {
      return NextResponse.json({
        error: 'Missing required fields: lead_id, action_type',
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');

    // Create supervisor action record
    const { data: action, error: actionError } = await supabase
      .from('supervisor_actions')
      .insert({
        lead_id: lead_id,
        supervisor_id: userProfile.id,
        action_type: action_type,
        action_data: action_data || {},
        notes: notes,
        ip_address: ipAddress || undefined,
        user_agent: userAgent || undefined,
        created_at: now,
      })
      .select()
      .single();

    if (actionError) {
      console.error('Error logging supervisor action:', actionError);
      return NextResponse.json({ error: 'Failed to log action' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Supervisor action logged successfully',
      action: action,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in log supervisor action API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

