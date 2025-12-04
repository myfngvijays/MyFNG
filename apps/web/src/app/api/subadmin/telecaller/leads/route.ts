/**
 * Telecaller Sub Admin Lead Quality Management API
 * GET /api/subadmin/telecaller/leads - Get leads (incomplete, duplicate, follow-ups)
 * POST /api/subadmin/telecaller/leads/[id]/correct - Correct lead fields
 * POST /api/subadmin/telecaller/leads/[id]/assign - Assign lead to telecaller
 * POST /api/subadmin/telecaller/leads/[id]/escalate - Escalate to Lead Manager
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/subadmin/telecaller/leads
 * Get leads for Telecaller Sub Admin (incomplete, duplicate, follow-ups)
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

    if (roleCode !== 'SUB_ADMIN' || department !== 'TELECALLER') {
      return NextResponse.json({ error: 'Forbidden: Telecaller Sub Admin role required' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter'); // 'incomplete' | 'duplicate' | 'followup' | 'all'
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Get team member IDs
    const { data: teamAssignments } = await supabase
      .from('subadmin_team_assignments')
      .select('team_member_id')
      .eq('subadmin_id', user.id)
      .eq('department', 'TELECALLER')
      .eq('is_active', true);

    const teamMemberIds = teamAssignments?.map(ta => ta.team_member_id) || [];

    let query = supabase
      .from('service_leads')
      .select(`
        id,
        lead_number,
        customer_name,
        customer_phone,
        customer_email,
        vehicle_number,
        vehicle_make,
        vehicle_model,
        vehicle_variant,
        address,
        city,
        state,
        pincode,
        status,
        is_incomplete,
        incomplete_reason,
        assigned_telecaller_id,
        telecaller_assigned_at,
        follow_up_required,
        next_follow_up_at,
        last_call_at,
        total_calls,
        created_at,
        updated_at,
        assigned_telecaller:users_login!assigned_telecaller_id(full_name, email)
      `, { count: 'exact' });

    // Apply filters
    if (filter === 'incomplete') {
      query = query.eq('is_incomplete', true);
    } else if (filter === 'followup') {
      query = query.eq('follow_up_required', true);
    } else if (filter === 'duplicate') {
      // Find duplicates by phone number
      // This is a simplified check - you may want to implement more sophisticated duplicate detection
      query = query.not('customer_phone', 'is', null);
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

    // Pagination
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: leads, error, count } = await query;

    if (error) {
      console.error('Error fetching leads:', error);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    // Detect duplicates (by phone number)
    const phoneMap = new Map();
    const duplicateLeads: string[] = [];
    
    leads?.forEach(lead => {
      if (lead.customer_phone) {
        if (phoneMap.has(lead.customer_phone)) {
          duplicateLeads.push(lead.id);
          duplicateLeads.push(phoneMap.get(lead.customer_phone));
        } else {
          phoneMap.set(lead.customer_phone, lead.id);
        }
      }
    });

    // Mark duplicates
    const leadsWithDuplicates = leads?.map(lead => ({
      ...lead,
      is_duplicate: duplicateLeads.includes(lead.id),
    }));

    return NextResponse.json({
      leads: leadsWithDuplicates || [],
      pagination: {
        page: page,
        limit: limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
      filters: {
        filter: filter || 'all',
        search: search || null,
      },
      stats: {
        incomplete_count: leads?.filter(l => l.is_incomplete).length || 0,
        followup_count: leads?.filter(l => l.follow_up_required).length || 0,
        duplicate_count: duplicateLeads.length / 2 || 0,
      },
    });

  } catch (error: any) {
    console.error('Error in GET /api/subadmin/telecaller/leads:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

