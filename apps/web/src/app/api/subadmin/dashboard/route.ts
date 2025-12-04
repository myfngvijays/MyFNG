/**
 * Sub Admin Dashboard API
 * GET /api/subadmin/dashboard
 * 
 * Returns department-specific dashboard data for Sub Admin
 * Includes: Team performance, SLA metrics, Escalations, Department-specific KPIs
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with role and department
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, department, full_name, roles!inner(role_code, role_name)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      console.error('Profile fetch error:', profileError);
      return NextResponse.json({ 
        error: 'User profile not found',
        details: profileError?.message 
      }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const department = userProfile.department;

    // Verify Sub Admin role
    if (roleCode !== 'SUB_ADMIN') {
      return NextResponse.json({ 
        error: 'Forbidden: Sub Admin role required',
        current_role: roleCode 
      }, { status: 403 });
    }

    // Verify department is set
    if (!department || !['CSE', 'TELECALLER', 'AUDITOR'].includes(department)) {
      console.error('Department validation failed:', { department, user_id: user.id });
      return NextResponse.json({ 
        error: 'Invalid department. Must be CSE, TELECALLER, or AUDITOR',
        current_department: department,
        user_id: user.id
      }, { status: 400 });
    }

    // Get today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // ============================================
    // 1. TEAM PERFORMANCE OVERVIEW
    // ============================================
    
    // Get team members assigned to this Sub Admin
    const { data: teamAssignments } = await supabase
      .from('subadmin_team_assignments')
      .select('team_member_id, team_member:users_login!team_member_id(id, full_name, is_active, last_login)')
      .eq('subadmin_id', user.id)
      .eq('department', department)
      .eq('is_active', true);

    const teamMemberIds = teamAssignments?.map(ta => ta.team_member_id) || [];
    
    // Count online/offline staff (active in last 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const { data: onlineStaff } = await supabase
      .from('users_login')
      .select('id')
      .in('id', teamMemberIds)
      .gte('last_login', thirtyMinutesAgo.toISOString());

    const totalStaff = teamMemberIds.length;
    const onlineStaffCount = onlineStaff?.length || 0;
    const offlineStaffCount = totalStaff - onlineStaffCount;

    // ============================================
    // 2. SLA MONITORING
    // ============================================
    
    const { data: slaData } = await supabase
      .from('subadmin_sla_monitoring')
      .select('sla_status, sla_deadline')
      .eq('department', department)
      .in('sla_status', ['AT_RISK', 'BREACHED']);

    const slaBreaches = slaData?.filter(s => s.sla_status === 'BREACHED').length || 0;
    const slaAtRisk = slaData?.filter(s => s.sla_status === 'AT_RISK').length || 0;

    // ============================================
    // 3. ESCALATIONS
    // ============================================
    
    const { data: escalations } = await supabase
      .from('escalations')
      .select('id, priority, status, escalation_type, created_at')
      .eq('department', department)
      .in('status', ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS']);

    const pendingEscalations = escalations?.length || 0;
    const urgentEscalations = escalations?.filter(e => e.priority === 'URGENT' || e.priority === 'CRITICAL').length || 0;

    // ============================================
    // 4. DEPARTMENT-SPECIFIC METRICS
    // ============================================
    
    let departmentMetrics: any = {};

    if (department === 'CSE') {
      // CSE Metrics
      const { data: tickets } = await supabase
        .from('customer_complaints')
        .select('id, status, assigned_to, created_at, resolved_at')
        .in('status', ['OPEN', 'IN_PROGRESS', 'ESCALATED']);

      const { data: todayResolutions } = await supabase
        .from('customer_complaints')
        .select('id')
        .eq('status', 'RESOLVED')
        .gte('resolved_at', todayStart.toISOString())
        .lte('resolved_at', todayEnd.toISOString());

      // Get average satisfaction score from CSE followups
      const { data: followups } = await supabase
        .from('cse_followups')
        .select('satisfaction_score')
        .not('satisfaction_score', 'is', null)
        .gte('completed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const avgSatisfaction = followups && followups.length > 0
        ? followups.reduce((sum, f) => sum + (f.satisfaction_score || 0), 0) / followups.length
        : 0;

      departmentMetrics = {
        open_tickets: tickets?.filter(t => t.status === 'OPEN').length || 0,
        in_progress_tickets: tickets?.filter(t => t.status === 'IN_PROGRESS').length || 0,
        escalated_tickets: tickets?.filter(t => t.status === 'ESCALATED').length || 0,
        sla_pending: slaAtRisk + slaBreaches,
        resolutions_today: todayResolutions?.length || 0,
        customer_satisfaction_score: Math.round(avgSatisfaction * 10) / 10, // Round to 1 decimal
      };

    } else if (department === 'TELECALLER') {
      // Telecaller Metrics
      const { data: followups } = await supabase
        .from('telecaller_follow_ups')
        .select('id, status, scheduled_time, completed_at')
        .eq('status', 'PENDING')
        .lte('scheduled_time', todayEnd.toISOString());

      // Get leads assigned to team members
      const { data: teamLeads } = await supabase
        .from('service_leads')
        .select('id, created_at')
        .in('assigned_telecaller_id', teamMemberIds.length > 0 ? teamMemberIds : ['00000000-0000-0000-0000-000000000000']);

      const todayLeads = teamLeads?.filter(l => {
        const created = new Date(l.created_at);
        return created >= todayStart && created <= todayEnd;
      }) || [];

      const { data: incompleteLeads } = await supabase
        .from('service_leads')
        .select('id')
        .eq('is_incomplete', true)
        .in('assigned_telecaller_id', teamMemberIds);

      const { data: callbacks } = await supabase
        .from('telecaller_follow_ups')
        .select('id')
        .eq('status', 'PENDING')
        .gte('scheduled_time', todayStart.toISOString())
        .lte('scheduled_time', todayEnd.toISOString());

      // Calculate conversion rate (leads completed / leads created in last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { data: recentLeads } = await supabase
        .from('service_leads')
        .select('id, status')
        .in('assigned_telecaller_id', teamMemberIds)
        .gte('created_at', sevenDaysAgo.toISOString());

      const completedLeads = recentLeads?.filter(l => ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED'].includes(l.status)).length || 0;
      const conversionRate = recentLeads && recentLeads.length > 0
        ? (completedLeads / recentLeads.length) * 100
        : 0;

      departmentMetrics = {
        followups_today: followups?.length || 0,
        leads_created: todayLeads?.length || 0,
        incomplete_leads: incompleteLeads?.length || 0,
        pending_callbacks: callbacks?.length || 0,
        conversion_rate: Math.round(conversionRate * 10) / 10, // Round to 1 decimal
      };

    } else if (department === 'AUDITOR') {
      // Auditor Metrics
      const { data: scheduledAudits } = await supabase
        .from('workshop_audits')
        .select('id, audit_status, scheduled_date')
        .eq('audit_status', 'SCHEDULED')
        .gte('scheduled_date', todayStart.toISOString().split('T')[0]);

      const { data: completedAudits } = await supabase
        .from('workshop_audits')
        .select('id, audit_status, actual_end_time')
        .eq('audit_status', 'COMPLETED')
        .gte('actual_end_time', todayStart.toISOString())
        .lte('actual_end_time', todayEnd.toISOString());

      const { data: failedAudits } = await supabase
        .from('workshop_audits')
        .select('id, audit_status, audit_grade')
        .eq('audit_status', 'COMPLETED')
        .in('audit_grade', ['D', 'F']);

      const { data: pendingApprovals } = await supabase
        .from('workshop_audits')
        .select('id, audit_status, approved_by')
        .eq('audit_status', 'COMPLETED')
        .is('approved_by', null);

      const { data: underObservation } = await supabase
        .from('workshop_audits')
        .select('workshop_id')
        .eq('audit_status', 'COMPLETED')
        .in('audit_grade', ['D', 'F'])
        .eq('requires_follow_up', true);

      departmentMetrics = {
        audits_scheduled: scheduledAudits?.length || 0,
        audits_completed: completedAudits?.length || 0,
        failed_audits: failedAudits?.length || 0,
        pending_approvals: pendingApprovals?.length || 0,
        workshops_under_observation: new Set(underObservation?.map(a => a.workshop_id) || []).size,
      };
    }

    // ============================================
    // 5. TASKS ASSIGNED TODAY
    // ============================================
    
    let tasksAssignedToday = 0;
    
    if (department === 'CSE') {
      const { data: todayTickets } = await supabase
        .from('customer_complaints')
        .select('id')
        .in('assigned_to', teamMemberIds)
        .gte('assigned_at', todayStart.toISOString())
        .lte('assigned_at', todayEnd.toISOString());
      tasksAssignedToday = todayTickets?.length || 0;
    } else if (department === 'TELECALLER') {
      const { data: todayLeads } = await supabase
        .from('service_leads')
        .select('id')
        .in('assigned_telecaller_id', teamMemberIds)
        .gte('telecaller_assigned_at', todayStart.toISOString())
        .lte('telecaller_assigned_at', todayEnd.toISOString());
      tasksAssignedToday = todayLeads?.length || 0;
    } else if (department === 'AUDITOR') {
      const { data: todayAudits } = await supabase
        .from('workshop_audits')
        .select('id')
        .in('auditor_id', teamMemberIds)
        .gte('scheduled_date', todayStart.toISOString().split('T')[0])
        .lte('scheduled_date', todayEnd.toISOString().split('T')[0]);
      tasksAssignedToday = todayAudits?.length || 0;
    }

    // ============================================
    // 6. QUALITY SCORE (Department-specific calculation)
    // ============================================
    
    let qualityScore = 0;
    
    if (department === 'CSE') {
      // CSE Quality = Average satisfaction score
      const { data: recentFollowups } = await supabase
        .from('cse_followups')
        .select('satisfaction_score')
        .not('satisfaction_score', 'is', null)
        .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      if (recentFollowups && recentFollowups.length > 0) {
        qualityScore = recentFollowups.reduce((sum, f) => sum + (f.satisfaction_score || 0), 0) / recentFollowups.length;
      }
    } else if (department === 'TELECALLER') {
      // Telecaller Quality = Accuracy score from performance metrics
      const { data: metrics } = await supabase
        .from('telecaller_performance_metrics')
        .select('accuracy_score')
        .in('telecaller_id', teamMemberIds)
        .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      
      if (metrics && metrics.length > 0) {
        qualityScore = metrics.reduce((sum, m) => sum + (m.accuracy_score || 0), 0) / metrics.length;
      }
    } else if (department === 'AUDITOR') {
      // Auditor Quality = Average audit score
      const { data: audits } = await supabase
        .from('workshop_audits')
        .select('score_percentage')
        .in('auditor_id', teamMemberIds)
        .eq('audit_status', 'COMPLETED')
        .gte('actual_end_time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      
      if (audits && audits.length > 0) {
        qualityScore = audits.reduce((sum, a) => sum + (a.score_percentage || 0), 0) / audits.length;
      }
    }

    // ============================================
    // 7. ALERTS
    // ============================================
    
    const alerts: Array<{
      type: string;
      severity: string;
      message: string;
      entity_id: string;
      entity_type: string;
    }> = [];

    // SLA Breach Alerts
    const { data: breachedSLA } = await supabase
      .from('subadmin_sla_monitoring')
      .select('id, entity_type, entity_id, sla_type, sla_deadline')
      .eq('department', department)
      .eq('sla_status', 'BREACHED')
      .eq('subadmin_notified', false)
      .limit(10);

    breachedSLA?.forEach(sla => {
      alerts.push({
        type: 'SLA_BREACH',
        severity: 'HIGH',
        message: `SLA breached for ${sla.sla_type}`,
        entity_id: sla.entity_id,
        entity_type: sla.entity_type,
      });
    });

    // Escalation Alerts
    escalations?.filter(e => e.priority === 'URGENT' || e.priority === 'CRITICAL').forEach(esc => {
      alerts.push({
        type: 'ESCALATION',
        severity: esc.priority,
        message: `Urgent escalation: ${esc.escalation_type}`,
        entity_id: esc.id,
        entity_type: 'ESCALATION',
      });
    });

    // Department-specific alerts
    if (department === 'CSE') {
      // High priority complaints
      const { data: highPriorityTickets } = await supabase
        .from('customer_complaints')
        .select('id, priority, severity')
        .eq('status', 'OPEN')
        .in('priority', ['HIGH', 'URGENT', 'CRITICAL'])
        .limit(5);
      
      highPriorityTickets?.forEach(ticket => {
        alerts.push({
          type: 'HIGH_PRIORITY_TICKET',
          severity: ticket.priority,
          message: `High priority ticket requires attention`,
          entity_id: ticket.id,
          entity_type: 'TICKET',
        });
      });
    } else if (department === 'TELECALLER') {
      // Missed follow-ups
      const { data: missedFollowups } = await supabase
        .from('telecaller_follow_ups')
        .select('id, scheduled_time')
        .eq('status', 'PENDING')
        .lt('scheduled_time', new Date().toISOString())
        .limit(5);
      
      missedFollowups?.forEach(fu => {
        alerts.push({
          type: 'MISSED_FOLLOWUP',
          severity: 'MEDIUM',
          message: `Follow-up missed`,
          entity_id: fu.id,
          entity_type: 'FOLLOWUP',
        });
      });
    } else if (department === 'AUDITOR') {
      // Failed audits requiring action
      const { data: failedAudits } = await supabase
        .from('workshop_audits')
        .select('id, audit_grade, requires_follow_up')
        .eq('audit_status', 'COMPLETED')
        .in('audit_grade', ['D', 'F'])
        .eq('requires_follow_up', true)
        .limit(5);
      
      failedAudits?.forEach(audit => {
        alerts.push({
          type: 'FAILED_AUDIT',
          severity: 'HIGH',
          message: `Failed audit requires follow-up`,
          entity_id: audit.id,
          entity_type: 'AUDIT',
        });
      });
    }

    // ============================================
    // RESPONSE
    // ============================================
    
    return NextResponse.json({
      team_overview: {
        total_staff: totalStaff,
        online_staff: onlineStaffCount,
        offline_staff: offlineStaffCount,
        tasks_assigned_today: tasksAssignedToday,
        sla_breaches: slaBreaches,
        sla_at_risk: slaAtRisk,
        pending_escalations: pendingEscalations,
        urgent_escalations: urgentEscalations,
        quality_score: Math.round(qualityScore * 10) / 10,
      },
      department_metrics: departmentMetrics,
      alerts: alerts.slice(0, 20), // Limit to 20 most recent alerts
      department: department,
      subadmin_name: userProfile.full_name,
    });

  } catch (error: any) {
    console.error('Error in GET /api/subadmin/dashboard:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

