/**
 * Sub Admin Team Performance API
 * GET /api/subadmin/team/performance
 * Get performance metrics for all team members
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

    // Get team member IDs
    const { data: teamAssignments } = await supabase
      .from('subadmin_team_assignments')
      .select('team_member_id')
      .eq('subadmin_id', user.id)
      .eq('department', department)
      .eq('is_active', true);

    const teamMemberIds = teamAssignments?.map(ta => ta.team_member_id) || [];

    if (teamMemberIds.length === 0) {
      return NextResponse.json({
        team_performance: [],
        total_members: 0,
        department: department,
      });
    }

    // Get date range (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const today = new Date();

    let performanceData: any[] = [];

    if (department === 'CSE') {
      // CSE Performance Metrics
      const { data: metrics } = await supabase
        .from('cse_performance_metrics')
        .select('*')
        .in('cse_id', teamMemberIds)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      // Get team member details
      const { data: teamMembers } = await supabase
        .from('users_login')
        .select('id, full_name, email, last_login')
        .in('id', teamMemberIds);

      // Aggregate metrics by team member
      const memberMetrics = new Map();
      
      teamMembers?.forEach(member => {
        memberMetrics.set(member.id, {
          member_id: member.id,
          member_name: member.full_name,
          member_email: member.email,
          last_login: member.last_login,
          total_followups_scheduled: 0,
          total_followups_completed: 0,
          followups_pending: 0,
          followups_overdue: 0,
          avg_call_duration: 0,
          leads_closed: 0,
          complaints_resolved: 0,
          escalations_handled: 0,
          avg_satisfaction_score: 0,
          issue_resolution_rate: 0,
        });
      });

      // Aggregate metrics
      metrics?.forEach(metric => {
        const member = memberMetrics.get(metric.cse_id);
        if (member) {
          member.total_followups_scheduled += metric.total_followups_scheduled || 0;
          member.total_followups_completed += metric.total_followups_completed || 0;
          member.followups_pending += metric.followups_pending || 0;
          member.followups_overdue += metric.followups_overdue || 0;
          member.leads_closed += metric.leads_closed || 0;
          member.complaints_resolved += metric.complaints_resolved || 0;
          member.escalations_handled += metric.escalations_handled || 0;
          
          // Calculate averages
          if (metric.avg_call_duration) {
            member.avg_call_duration = (member.avg_call_duration + metric.avg_call_duration) / 2;
          }
          if (metric.avg_satisfaction_score) {
            member.avg_satisfaction_score = (member.avg_satisfaction_score + metric.avg_satisfaction_score) / 2;
          }
          if (metric.issue_resolution_rate) {
            member.issue_resolution_rate = (member.issue_resolution_rate + metric.issue_resolution_rate) / 2;
          }
        }
      });

      performanceData = Array.from(memberMetrics.values());

    } else if (department === 'TELECALLER') {
      // Telecaller Performance Metrics
      const { data: metrics } = await supabase
        .from('telecaller_performance_metrics')
        .select('*')
        .in('telecaller_id', teamMemberIds)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      // Get team member details
      const { data: teamMembers } = await supabase
        .from('users_login')
        .select('id, full_name, email, last_login')
        .in('id', teamMemberIds);

      // Aggregate metrics by team member
      const memberMetrics = new Map();
      
      teamMembers?.forEach(member => {
        memberMetrics.set(member.id, {
          member_id: member.id,
          member_name: member.full_name,
          member_email: member.email,
          last_login: member.last_login,
          total_calls: 0,
          answered_calls: 0,
          missed_calls: 0,
          leads_created: 0,
          leads_completed: 0,
          leads_followed_up: 0,
          call_to_lead_conversion_rate: 0,
          follow_up_success_rate: 0,
          accuracy_score: 0,
          duplicate_leads_created: 0,
          missed_follow_ups: 0,
        });
      });

      // Aggregate metrics
      metrics?.forEach(metric => {
        const member = memberMetrics.get(metric.telecaller_id);
        if (member) {
          member.total_calls += metric.total_calls || 0;
          member.answered_calls += metric.answered_calls || 0;
          member.missed_calls += metric.missed_calls || 0;
          member.leads_created += metric.leads_created || 0;
          member.leads_completed += metric.leads_completed || 0;
          member.leads_followed_up += metric.leads_followed_up || 0;
          member.duplicate_leads_created += metric.duplicate_leads_created || 0;
          member.missed_follow_ups += metric.missed_follow_ups || 0;
          
          // Calculate averages
          if (metric.call_to_lead_conversion_rate) {
            member.call_to_lead_conversion_rate = (member.call_to_lead_conversion_rate + metric.call_to_lead_conversion_rate) / 2;
          }
          if (metric.follow_up_success_rate) {
            member.follow_up_success_rate = (member.follow_up_success_rate + metric.follow_up_success_rate) / 2;
          }
          if (metric.accuracy_score) {
            member.accuracy_score = (member.accuracy_score + metric.accuracy_score) / 2;
          }
        }
      });

      performanceData = Array.from(memberMetrics.values());

    } else if (department === 'AUDITOR') {
      // Auditor Performance Metrics
      const { data: metrics } = await supabase
        .from('auditor_performance_metrics')
        .select('*')
        .in('auditor_id', teamMemberIds)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      // Get team member details
      const { data: teamMembers } = await supabase
        .from('users_login')
        .select('id, full_name, email, last_login')
        .in('id', teamMemberIds);

      // Aggregate metrics by team member
      const memberMetrics = new Map();
      
      teamMembers?.forEach(member => {
        memberMetrics.set(member.id, {
          member_id: member.id,
          member_name: member.full_name,
          member_email: member.email,
          last_login: member.last_login,
          audits_scheduled: 0,
          audits_completed: 0,
          audits_cancelled: 0,
          workshops_passed: 0,
          workshops_failed: 0,
          follow_ups_required: 0,
          critical_issues_identified: 0,
          action_items_created: 0,
          completion_rate: 0,
        });
      });

      // Aggregate metrics
      metrics?.forEach(metric => {
        const member = memberMetrics.get(metric.auditor_id);
        if (member) {
          member.audits_scheduled += metric.audits_scheduled || 0;
          member.audits_completed += metric.audits_completed || 0;
          member.audits_cancelled += metric.audits_cancelled || 0;
          member.workshops_passed += metric.workshops_passed || 0;
          member.workshops_failed += metric.workshops_failed || 0;
          member.follow_ups_required += metric.follow_ups_required || 0;
          member.critical_issues_identified += metric.critical_issues_identified || 0;
          member.action_items_created += metric.action_items_created || 0;
          
          // Calculate averages
          if (metric.completion_rate) {
            member.completion_rate = (member.completion_rate + metric.completion_rate) / 2;
          }
        }
      });

      performanceData = Array.from(memberMetrics.values());
    }

    return NextResponse.json({
      team_performance: performanceData,
      total_members: teamMemberIds.length,
      department: department,
      period: {
        start: sevenDaysAgo.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0],
      },
    });

  } catch (error: any) {
    console.error('Error in GET /api/subadmin/team/performance:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

