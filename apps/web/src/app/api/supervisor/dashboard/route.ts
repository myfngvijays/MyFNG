import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/supervisor/dashboard
 * 
 * Fetch real-time metrics for supervisor dashboard
 * 
 * Response includes:
 * - 8 key metrics
 * - Mechanic performance data
 * - Workshop-specific data
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to verify supervisor role and workshop
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('role_id, workshop_id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify supervisor role
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_SUPERVISOR') {
      return NextResponse.json({ error: 'Forbidden: Supervisor role required' }, { status: 403 });
    }

    const workshopId = userProfile.workshop_id;
    if (!workshopId) {
      return NextResponse.json({ error: 'No workshop assigned' }, { status: 400 });
    }

    // Fetch dashboard metrics using the view
    const { data: metricsData, error: metricsError } = await supabase
      .from('supervisor_dashboard_metrics')
      .select('*')
      .eq('workshop_id', workshopId)
      .single();

    // If no data in view, calculate manually
    let metrics = {
      totalJobsToday: 0,
      assignedJobs: 0,
      inProgressJobs: 0,
      jobsOnHold: 0,
      jobsAwaitingQC: 0,
      pendingPickups: 0,
      pendingExtraWorkApprovals: 0,
      slaAtRiskJobs: 0
    };

    if (metricsData) {
      metrics = {
        totalJobsToday: metricsData.total_jobs_today || 0,
        assignedJobs: metricsData.assigned_jobs || 0,
        inProgressJobs: metricsData.in_progress_jobs || 0,
        jobsOnHold: metricsData.jobs_on_hold || 0,
        jobsAwaitingQC: metricsData.jobs_awaiting_qc || 0,
        pendingPickups: metricsData.pending_pickups || 0,
        pendingExtraWorkApprovals: metricsData.pending_extra_work_approvals || 0,
        slaAtRiskJobs: metricsData.sla_at_risk_jobs || 0
      };
    } else {
      // Fallback: Calculate metrics manually
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Total jobs today
      const { count: totalToday } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .gte('created_at', today.toISOString());
      metrics.totalJobsToday = totalToday || 0;

      // Assigned jobs
      const { count: assigned } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .eq('status', 'ASSIGNED');
      metrics.assignedJobs = assigned || 0;

      // In progress jobs
      const { count: inProgress } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .eq('status', 'IN_PROGRESS');
      metrics.inProgressJobs = inProgress || 0;

      // Jobs on hold
      const { count: onHold } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .eq('status', 'HOLD');
      metrics.jobsOnHold = onHold || 0;

      // Jobs awaiting QC
      const { count: awaitingQC } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .eq('status', 'COMPLETED')
        .eq('qc_status', 'PENDING');
      metrics.jobsAwaitingQC = awaitingQC || 0;

      // Pending pickups
      const { count: pickups } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .eq('pickup_required', true)
        .in('pickup_status', ['PENDING', 'ASSIGNED']);
      metrics.pendingPickups = pickups || 0;

      // Pending extra work approvals
      const { data: workshopLeads } = await supabase
        .from('service_leads')
        .select('id')
        .eq('workshop_id', workshopId);
      
      const workshopLeadIds = workshopLeads?.map(l => l.id) || [];
      
      if (workshopLeadIds.length > 0) {
        const { data: leadsWithPendingCharges } = await supabase
          .from('lead_extra_charges')
          .select('lead_id', { count: 'exact' })
          .eq('status', 'PENDING')
          .in('lead_id', workshopLeadIds);
        metrics.pendingExtraWorkApprovals = leadsWithPendingCharges?.length || 0;
      } else {
        metrics.pendingExtraWorkApprovals = 0;
      }

      // SLA at-risk jobs
      const { count: slaRisk } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .in('sla_status', ['AT_RISK', 'BREACHED'])
        .not('status', 'in', '(REJECTED,CLOSED,CANCELLED)');
      metrics.slaAtRiskJobs = slaRisk || 0;
    }

    // Fetch mechanic performance data
    const { data: mechanics, error: mechanicsError } = await supabase
      .from('users_login')
      .select(`
        id,
        full_name,
        profile_image,
        roles!inner(role_code)
      `)
      .eq('workshop_id', workshopId)
      .eq('roles.role_code', 'WORKSHOP_MECHANIC')
      .eq('is_active', true);

    // Calculate stats for each mechanic
    const mechanicsWithStats = await Promise.all(
      (mechanics || []).map(async (mechanic) => {
        // Active jobs
        const { count: activeJobs } = await supabase
          .from('service_leads')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_mechanic_id', mechanic.id)
          .in('status', ['ASSIGNED', 'IN_PROGRESS']);

        // Completed today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const { count: completedToday } = await supabase
          .from('service_leads')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_mechanic_id', mechanic.id)
          .eq('status', 'COMPLETED')
          .gte('updated_at', todayStart.toISOString());

        // Calculate efficiency (completed jobs vs total assigned in last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { count: totalAssigned } = await supabase
          .from('mechanic_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('mechanic_id', mechanic.id)
          .gte('assigned_at', sevenDaysAgo.toISOString());

        const { count: totalCompleted } = await supabase
          .from('service_leads')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_mechanic_id', mechanic.id)
          .eq('status', 'COMPLETED')
          .gte('updated_at', sevenDaysAgo.toISOString());

        const efficiency = totalAssigned && totalAssigned > 0 
          ? Math.round((totalCompleted || 0) / totalAssigned * 100) 
          : 0;

        return {
          id: mechanic.id,
          name: mechanic.full_name,
          profileImage: mechanic.profile_image,
          activeJobs: activeJobs || 0,
          completedToday: completedToday || 0,
          efficiency: Math.min(efficiency, 100) // Cap at 100%
        };
      })
    );

    // Return complete dashboard data
    return NextResponse.json({
      success: true,
      data: {
        metrics,
        mechanics: mechanicsWithStats,
        workshopId
      }
    });

  } catch (error: any) {
    console.error('Supervisor dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: error.message },
      { status: 500 }
    );
  }
}

