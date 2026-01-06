/**
 * Auditor Sub Admin Audit Management API
 * GET /api/subadmin/auditor/audits - Get audits
 * POST /api/subadmin/auditor/audits/schedule - Schedule audit
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyWorkshopRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * GET /api/subadmin/auditor/audits
 * Get audits for Auditor Sub Admin
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, department, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const department = userProfile.department;

    if (roleCode !== 'SUB_ADMIN' || department !== 'AUDITOR') {
      return NextResponse.json({ error: 'Forbidden: Auditor Sub Admin role required' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const auditType = searchParams.get('audit_type');
    const workshopId = searchParams.get('workshop_id');
    const assignedTo = searchParams.get('assigned_to');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Get team member IDs
    const { data: teamAssignments } = await supabase
      .from('subadmin_team_assignments')
      .select('team_member_id')
      .eq('subadmin_id', user.id)
      .eq('department', 'AUDITOR')
      .eq('is_active', true);

    const teamMemberIds = teamAssignments?.map(ta => ta.team_member_id) || [];

    // Build query
    let query = supabase
      .from('workshop_audits')
      .select(`
        *,
        workshop:workshops!workshop_id(
          id,
          name,
          address,
          city,
          state,
          phone,
          email
        ),
        auditor:users_login!auditor_id(full_name, email),
        approved_by_user:users_login!approved_by(full_name, email)
      `, { count: 'exact' });

    // Filter by status
    if (status) {
      query = query.in('audit_status', status.split(','));
    } else {
      query = query.in('audit_status', ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED']);
    }

    // Filter by audit type
    if (auditType) {
      query = query.eq('audit_type', auditType);
    }

    // Filter by workshop
    if (workshopId) {
      query = query.eq('workshop_id', workshopId);
    }

    // Filter by assigned team members
    if (!assignedTo && teamMemberIds.length > 0) {
      query = query.in('auditor_id', teamMemberIds);
    } else if (assignedTo) {
      query = query.eq('auditor_id', assignedTo);
    }

    // Search filter
    if (search) {
      query = query.or(`workshop:workshops.name.ilike.%${search}%`);
    }

    // Pagination
    query = query.order('scheduled_date', { ascending: false }).range(offset, offset + limit - 1);

    const { data: audits, error, count } = await query;

    if (error) {
      console.error('Error fetching audits:', error);
      return NextResponse.json({ error: 'Failed to fetch audits' }, { status: 500 });
    }

    return NextResponse.json({
      audits: audits || [],
      pagination: {
        page: page,
        limit: limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
      filters: {
        status: status || null,
        audit_type: auditType || null,
        workshop_id: workshopId || null,
        assigned_to: assignedTo || null,
        search: search || null,
      },
    });

  } catch (error: any) {
    console.error('Error in GET /api/subadmin/auditor/audits:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/subadmin/auditor/audits/schedule
 * Schedule new audit
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, department, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const department = userProfile.department;

    if (roleCode !== 'SUB_ADMIN' || department !== 'AUDITOR') {
      return NextResponse.json({ error: 'Forbidden: Auditor Sub Admin role required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      workshop_id,
      auditor_id,
      audit_type,
      scheduled_date,
      scheduled_time,
      notes,
    } = body;

    if (!workshop_id || !auditor_id || !audit_type || !scheduled_date) {
      return NextResponse.json(
        { error: 'workshop_id, auditor_id, audit_type, and scheduled_date are required' },
        { status: 400 }
      );
    }

    // Verify auditor is a team member
    const { data: teamAssignment } = await supabase
      .from('subadmin_team_assignments')
      .select('team_member_id')
      .eq('subadmin_id', user.id)
      .eq('team_member_id', auditor_id)
      .eq('department', 'AUDITOR')
      .eq('is_active', true)
      .single();

    if (!teamAssignment) {
      return NextResponse.json(
        { error: 'Auditor is not assigned to your team' },
        { status: 403 }
      );
    }

    // Create audit
    const { data: newAudit, error: insertError } = await supabase
      .from('workshop_audits')
      .insert({
        workshop_id: workshop_id,
        auditor_id: auditor_id,
        audit_type: audit_type,
        audit_status: 'SCHEDULED',
        scheduled_date: scheduled_date,
        scheduled_time: scheduled_time || null,
        notes: notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError || !newAudit) {
      console.error('Error scheduling audit:', insertError);
      return NextResponse.json(
        { error: 'Failed to schedule audit', details: insertError?.message },
        { status: 500 }
      );
    }

    // Log action
    await supabase.from('subadmin_actions').insert({
      subadmin_id: user.id,
      department: 'AUDITOR',
      action_type: 'SCHEDULE_AUDIT',
      action_description: `Scheduled ${audit_type} audit for workshop ${workshop_id}`,
      related_entity_type: 'AUDIT',
      related_entity_id: newAudit.id,
      metadata: {
        workshop_id: workshop_id,
        auditor_id: auditor_id,
        audit_type: audit_type,
        scheduled_date: scheduled_date,
      },
    });

    // Notify workshop admin/supervisor
    try {
      const { data: workshop } = await supabase
        .from('workshops')
        .select('name')
        .eq('id', workshop_id)
        .maybeSingle();

      const dateStr = scheduled_date ? String(scheduled_date) : '';
      const timeStr = scheduled_time ? ` ${String(scheduled_time)}` : '';
      const workshopName = (workshop as any)?.name ? ` (${(workshop as any).name})` : '';

      await notifyWorkshopRoles({
        workshopId: workshop_id,
        roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
        type: 'SYSTEM_ALERT',
        title: 'Audit Scheduled',
        message: `${audit_type} audit scheduled on ${dateStr}${timeStr}${workshopName}. Keep documents and facility ready.`,
        priority: 'MEDIUM',
        actionUrl: '/dashboard/workshop_admin/settings',
        metadata: {
          kind: 'AUDIT_SCHEDULED',
          audit_id: newAudit.id,
          audit_type,
          scheduled_date,
          scheduled_time: scheduled_time || null,
        },
      });
    } catch (e) {
      console.warn('Audit scheduled notification failed (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      audit: newAudit,
      message: 'Audit scheduled successfully',
    });

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/auditor/audits/schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

