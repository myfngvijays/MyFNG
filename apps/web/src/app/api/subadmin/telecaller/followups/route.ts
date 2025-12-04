/**
 * Telecaller Sub Admin Follow-up Monitoring API
 * GET /api/subadmin/telecaller/followups
 * Monitor follow-ups (missed, wrong status, no-call, fake updates)
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

    if (roleCode !== 'SUB_ADMIN' || department !== 'TELECALLER') {
      return NextResponse.json({ error: 'Forbidden: Telecaller Sub Admin role required' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter'); // 'missed' | 'wrong_status' | 'no_call' | 'all'
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

    const now = new Date();

    // Get follow-ups
    let query = supabase
      .from('telecaller_follow_ups')
      .select(`
        *,
        lead:service_leads!lead_id(
          id,
          lead_number,
          customer_name,
          customer_phone,
          status,
          assigned_telecaller_id
        ),
        telecaller:users_login!telecaller_id(full_name, email)
      `, { count: 'exact' })
      .in('telecaller_id', teamMemberIds.length > 0 ? teamMemberIds : ['00000000-0000-0000-0000-000000000000']);

    // Apply filters
    if (filter === 'missed') {
      query = query.eq('status', 'PENDING').lt('scheduled_time', now.toISOString());
    } else if (filter === 'wrong_status') {
      // This would require checking lead status vs follow-up status
      // Simplified: get pending follow-ups for leads that are already completed
      query = query.eq('status', 'PENDING');
    } else {
      query = query.in('status', ['PENDING', 'COMPLETED']);
    }

    // Pagination
    query = query.order('scheduled_time', { ascending: false }).range(offset, offset + limit - 1);

    const { data: followups, error, count } = await query;

    if (error) {
      console.error('Error fetching follow-ups:', error);
      return NextResponse.json({ error: 'Failed to fetch follow-ups' }, { status: 500 });
    }

    // Analyze follow-ups for issues
    const analyzedFollowups = followups?.map(fu => {
      const scheduled = new Date(fu.scheduled_time);
      const isMissed = fu.status === 'PENDING' && scheduled < now;
      const hasNoCall = !fu.completed_at && fu.status === 'PENDING' && scheduled < new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Check for wrong status (follow-up pending but lead already completed)
      const wrongStatus = fu.status === 'PENDING' && 
        fu.lead && 
        ['COMPLETED', 'DELIVERED', 'CLOSED', 'CANCELLED'].includes(fu.lead.status);

      return {
        ...fu,
        is_missed: isMissed,
        has_no_call: hasNoCall,
        wrong_status: wrongStatus,
        issues: [
          isMissed && 'MISSED',
          hasNoCall && 'NO_CALL',
          wrongStatus && 'WRONG_STATUS',
        ].filter(Boolean),
      };
    }) || [];

    // Get leads with no follow-up but should have
    const { data: leadsNeedingFollowup } = await supabase
      .from('service_leads')
      .select('id, lead_number, customer_name, customer_phone, follow_up_required, next_follow_up_at')
      .in('assigned_telecaller_id', teamMemberIds.length > 0 ? teamMemberIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('follow_up_required', true)
      .lt('next_follow_up_at', now.toISOString())
      .limit(20);

    return NextResponse.json({
      followups: analyzedFollowups,
      leads_needing_followup: leadsNeedingFollowup || [],
      pagination: {
        page: page,
        limit: limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
      stats: {
        missed_count: analyzedFollowups.filter(f => f.is_missed).length,
        no_call_count: analyzedFollowups.filter(f => f.has_no_call).length,
        wrong_status_count: analyzedFollowups.filter(f => f.wrong_status).length,
        pending_followups: analyzedFollowups.filter(f => f.status === 'PENDING').length,
      },
    });

  } catch (error: any) {
    console.error('Error in GET /api/subadmin/telecaller/followups:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

