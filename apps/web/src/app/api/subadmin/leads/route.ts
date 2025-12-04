/**
 * Sub Admin Leads Management API
 * GET /api/subadmin/leads?dept=CSE|TELECALLER|AUDITOR
 * Get leads relevant to Sub Admin's department
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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

    if (roleCode !== 'SUB_ADMIN' || !department) {
      return NextResponse.json({ error: 'Forbidden: Sub Admin role required' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const slaStatus = searchParams.get('sla_status');
    const search = searchParams.get('search'); // phone, lead_id, customer_name
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Get team member IDs
    const { data: teamAssignments } = await supabase
      .from('subadmin_team_assignments')
      .select('team_member_id')
      .eq('subadmin_id', user.id)
      .eq('department', department)
      .eq('is_active', true);

    const teamMemberIds = teamAssignments?.map(ta => ta.team_member_id) || [];

    let leads: any[] = [];
    let totalCount = 0;

    if (department === 'CSE') {
      // CSE: Get tickets/complaints
      let query = supabase
        .from('customer_complaints')
        .select(`
          id,
          complaint_number,
          lead_id,
          customer_id,
          status,
          priority,
          severity,
          complaint_type,
          description,
          assigned_to,
          assigned_at,
          escalated_to_level,
          escalated_at,
          created_at,
          updated_at,
          customer:users_login!customer_id(full_name, phone, email),
          lead:service_leads!lead_id(lead_number, vehicle_number, status)
        `, { count: 'exact' });

      // Filter by status
      if (status) {
        query = query.in('status', status.split(','));
      } else {
        query = query.in('status', ['OPEN', 'IN_PROGRESS', 'ESCALATED']);
      }

      // Filter by assigned team members
      if (teamMemberIds.length > 0) {
        query = query.in('assigned_to', teamMemberIds);
      }

      // Search filter
      if (search) {
        query = query.or(`complaint_number.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // Pagination
      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching CSE leads:', error);
        return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
      }

      leads = data || [];
      totalCount = count || 0;

    } else if (department === 'TELECALLER') {
      // Telecaller: Get service leads
      let query = supabase
        .from('service_leads')
        .select(`
          id,
          lead_number,
          customer_name,
          customer_phone,
          vehicle_number,
          status,
          is_incomplete,
          incomplete_reason,
          assigned_telecaller_id,
          telecaller_assigned_at,
          follow_up_required,
          next_follow_up_at,
          created_at,
          updated_at
        `, { count: 'exact' });

      // Filter by incomplete leads or follow-ups
      const filterType = searchParams.get('filter');
      if (filterType === 'incomplete') {
        query = query.eq('is_incomplete', true);
      } else if (filterType === 'followup') {
        query = query.eq('follow_up_required', true);
      }

      // Filter by status
      if (status) {
        query = query.in('status', status.split(','));
      }

      // Filter by assigned team members
      if (teamMemberIds.length > 0) {
        query = query.in('assigned_telecaller_id', teamMemberIds);
      } else {
        // If no team members, return empty
        query = query.eq('assigned_telecaller_id', '00000000-0000-0000-0000-000000000000');
      }

      // Search filter
      if (search) {
        query = query.or(`lead_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,vehicle_number.ilike.%${search}%`);
      }

      // SLA filter
      if (slaStatus) {
        query = query.eq('sla_status', slaStatus);
      }

      // Pagination
      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching Telecaller leads:', error);
        return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
      }

      leads = data || [];
      totalCount = count || 0;

    } else if (department === 'AUDITOR') {
      // Auditor: Get workshop audits
      let query = supabase
        .from('workshop_audits')
        .select(`
          id,
          workshop_id,
          auditor_id,
          audit_type,
          audit_status,
          scheduled_date,
          scheduled_time,
          actual_start_time,
          actual_end_time,
          overall_score,
          score_percentage,
          audit_grade,
          approved_by,
          approved_at,
          rejection_reason,
          requires_follow_up,
          created_at,
          updated_at,
          workshop:workshops!workshop_id(name, address, city, phone),
          auditor:users_login!auditor_id(full_name, email)
        `, { count: 'exact' });

      // Filter by audit status
      if (status) {
        query = query.in('audit_status', status.split(','));
      } else {
        query = query.in('audit_status', ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED']);
      }

      // Filter by assigned team members
      if (teamMemberIds.length > 0) {
        query = query.in('auditor_id', teamMemberIds);
      }

      // Search filter
      if (search) {
        query = query.or(`workshop:workshops.name.ilike.%${search}%`);
      }

      // Pagination
      query = query.order('scheduled_date', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching Auditor audits:', error);
        return NextResponse.json({ error: 'Failed to fetch audits' }, { status: 500 });
      }

      leads = data || [];
      totalCount = count || 0;
    }

    return NextResponse.json({
      leads: leads,
      pagination: {
        page: page,
        limit: limit,
        total: totalCount,
        total_pages: Math.ceil(totalCount / limit),
      },
      department: department,
      filters: {
        status: status || null,
        sla_status: slaStatus || null,
        search: search || null,
      },
    });

  } catch (error: any) {
    console.error('Error in GET /api/subadmin/leads:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

