/**
 * CSE Sub Admin Ticket Management API
 * GET /api/subadmin/cse/tickets - Get all tickets
 * POST /api/subadmin/cse/tickets/[id]/assign - Assign ticket
 * POST /api/subadmin/cse/tickets/[id]/reassign - Reassign ticket
 * POST /api/subadmin/cse/tickets/[id]/merge - Merge duplicate tickets
 * POST /api/subadmin/cse/tickets/[id]/close - Close ticket
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/subadmin/cse/tickets
 * Get all tickets for CSE Sub Admin
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

    if (roleCode !== 'SUB_ADMIN' || department !== 'CSE') {
      return NextResponse.json({ error: 'Forbidden: CSE Sub Admin role required' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const slaStatus = searchParams.get('sla_status');
    const category = searchParams.get('category');
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
      .eq('department', 'CSE')
      .eq('is_active', true);

    const teamMemberIds = teamAssignments?.map(ta => ta.team_member_id) || [];

    // Build query
    let query = supabase
      .from('customer_complaints')
      .select(`
        *,
        customer:users_login!customer_id(full_name, phone, email),
        lead:service_leads!lead_id(lead_number, vehicle_number, status),
        assigned_cse:users_login!assigned_to(full_name, email),
        resolved_by_user:users_login!resolved_by(full_name, email)
      `, { count: 'exact' });

    // Filter by status
    if (status) {
      query = query.in('status', status.split(','));
    } else {
      query = query.in('status', ['OPEN', 'IN_PROGRESS', 'ESCALATED']);
    }

    // Filter by assigned team members (if assigned_to filter not specified)
    if (!assignedTo && teamMemberIds.length > 0) {
      query = query.in('assigned_to', teamMemberIds);
    } else if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    // Filter by category
    if (category) {
      query = query.eq('complaint_category', category);
    }

    // Search filter
    if (search) {
      query = query.or(`complaint_number.ilike.%${search}%,description.ilike.%${search}%,customer:users_login.full_name.ilike.%${search}%`);
    }

    // SLA filter (check service_leads for SLA status)
    // Note: This is a simplified version - you may need to join with SLA monitoring table

    // Pagination
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: tickets, error, count } = await query;

    if (error) {
      console.error('Error fetching tickets:', error);
      return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
    }

    return NextResponse.json({
      tickets: tickets || [],
      pagination: {
        page: page,
        limit: limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
      filters: {
        status: status || null,
        sla_status: slaStatus || null,
        category: category || null,
        assigned_to: assignedTo || null,
        search: search || null,
      },
    });

  } catch (error: any) {
    console.error('Error in GET /api/subadmin/cse/tickets:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

