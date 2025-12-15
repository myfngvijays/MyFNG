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

    // Get user profile (users_login is mapped by email/phone; not always same as auth user.id)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, role_id, roles!inner(role_code)';

    const { data: userProfileByEmail, error: profileErrorByEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileByPhone, error: profileErrorByPhone } = !userProfileByEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileById, error: profileErrorById } = !userProfileByEmail && !userProfileByPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null, error: null };

    const userProfile = userProfileByEmail || userProfileByPhone || userProfileById;

    if (!userProfile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          user_email: email || null,
          user_phone: phone || null,
          profile_lookup_errors: [profileErrorByEmail?.message, profileErrorByPhone?.message, profileErrorById?.message].filter(Boolean),
        },
        { status: 404 }
      );
    }

    // Verify user is allowed to log actions
    const roleCode = (userProfile.roles as any)?.role_code;
    const allowedRoles = ['WORKSHOP_SUPERVISOR', 'WORKSHOP_ADMIN', 'SUB_ADMIN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(roleCode)) {
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

