/**
 * Workshop Audits API
 * Purpose: Manage workshop audits for compliance
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

    const { searchParams } = new URL(request.url);
    const workshop_id = searchParams.get('workshop_id');
    const audit_status = searchParams.get('status');
    const audit_type = searchParams.get('type');

    let query = supabase
      .from('workshop_audits')
      .select(`
        *,
        workshop:workshops(id, name, city, state),
        auditor:users_login!auditor_id(id, full_name, role),
        approved_by_user:users_login!approved_by(id, full_name)
      `)
      .order('scheduled_date', { ascending: false });

    if (workshop_id) {
      query = query.eq('workshop_id', workshop_id);
    }

    if (audit_status) {
      query = query.eq('audit_status', audit_status);
    }

    if (audit_type) {
      query = query.eq('audit_type', audit_type);
    }

    const { data: audits, error: auditsError } = await query;

    if (auditsError) {
      console.error('Error fetching audits:', auditsError);
      return NextResponse.json({ error: 'Failed to fetch audits' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      audits: audits || [],
      total: audits?.length || 0,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in workshop audits API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Schedule Workshop Audit
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

    // Verify user has audit permissions
    const allowedRoles = ['super_admin', 'sub_admin', 'auditor'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      workshop_id,
      auditor_id,
      audit_type, // COMPLIANCE, QUALITY, SAFETY, etc.
      scheduled_date,
      scheduled_time,
      notes,
    } = body;

    if (!workshop_id || !auditor_id || !audit_type || !scheduled_date) {
      return NextResponse.json({
        error: 'Missing required fields: workshop_id, auditor_id, audit_type, scheduled_date',
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Create audit record
    const { data: audit, error: auditError } = await supabase
      .from('workshop_audits')
      .insert({
        workshop_id: workshop_id,
        auditor_id: auditor_id,
        audit_type: audit_type,
        audit_status: 'SCHEDULED',
        scheduled_date: scheduled_date,
        scheduled_time: scheduled_time,
        notes: notes,
        created_at: now,
      })
      .select()
      .single();

    if (auditError) {
      console.error('Error creating audit:', auditError);
      return NextResponse.json({ error: 'Failed to schedule audit' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Workshop audit scheduled successfully',
      audit: audit,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in schedule audit API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

