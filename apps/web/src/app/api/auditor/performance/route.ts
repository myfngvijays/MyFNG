/**
 * Auditor Performance API
 * GET /api/auditor/performance
 * 
 * Fetch auditor performance metrics and KPIs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Auditor role
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    if (roleCode !== 'AUDITOR') {
      return NextResponse.json({ error: 'Forbidden: Auditor role required' }, { status: 403 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const period = searchParams.get('period') || '30'; // days

    // Calculate date range
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000);

    // Get performance metrics from auditor_performance_metrics table
    const { data: metrics, error: metricsError } = await supabase
      .from('auditor_performance_metrics')
      .select('*')
      .eq('auditor_id', user.id)
      .gte('date', start.toISOString().split('T')[0])
      .lte('date', end.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (metricsError) {
      console.error('Error fetching performance metrics:', metricsError);
    }

    // Calculate aggregated metrics
    const aggregated = {
      audits_scheduled: 0,
      audits_completed: 0,
      audits_cancelled: 0,
      audits_in_progress: 0,
      total_audit_time: 0,
      avg_audit_duration: 0,
      workshops_passed: 0,
      workshops_failed: 0,
      follow_ups_required: 0,
      critical_issues_identified: 0,
      action_items_created: 0,
      action_items_verified: 0,
      audits_per_day: 0,
      completion_rate: 0,
    };

    if (metrics && metrics.length > 0) {
      metrics.forEach((metric: any) => {
        aggregated.audits_scheduled += metric.audits_scheduled || 0;
        aggregated.audits_completed += metric.audits_completed || 0;
        aggregated.audits_cancelled += metric.audits_cancelled || 0;
        aggregated.audits_in_progress += metric.audits_in_progress || 0;
        aggregated.total_audit_time += metric.total_audit_time || 0;
        aggregated.workshops_passed += metric.workshops_passed || 0;
        aggregated.workshops_failed += metric.workshops_failed || 0;
        aggregated.follow_ups_required += metric.follow_ups_required || 0;
        aggregated.critical_issues_identified += metric.critical_issues_identified || 0;
        aggregated.action_items_created += metric.action_items_created || 0;
        aggregated.action_items_verified += metric.action_items_verified || 0;
      });

      const days = metrics.length;
      aggregated.avg_audit_duration = aggregated.total_audit_time / (aggregated.audits_completed || 1);
      aggregated.audits_per_day = aggregated.audits_completed / days;
      aggregated.completion_rate = aggregated.audits_scheduled > 0 
        ? (aggregated.audits_completed / aggregated.audits_scheduled) * 100 
        : 0;
    }

    // Get recent audits for trend analysis
    const { data: recentAudits, error: recentAuditsError } = await supabase
      .from('workshop_audits')
      .select('id, audit_status, audit_grade, score_percentage, created_at, duration_minutes')
      .eq('auditor_id', user.id)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    // Calculate trends (last 7 days vs previous 7 days)
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previous7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const { count: last7DaysCount } = await supabase
      .from('workshop_audits')
      .select('*', { count: 'exact', head: true })
      .eq('auditor_id', user.id)
      .eq('audit_status', 'COMPLETED')
      .gte('created_at', last7Days.toISOString())
      .lte('created_at', now.toISOString());

    const { count: previous7DaysCount } = await supabase
      .from('workshop_audits')
      .select('*', { count: 'exact', head: true })
      .eq('auditor_id', user.id)
      .eq('audit_status', 'COMPLETED')
      .gte('created_at', previous7Days.toISOString())
      .lte('created_at', last7Days.toISOString());

    const trend = previous7DaysCount && previous7DaysCount > 0
      ? ((last7DaysCount || 0) - previous7DaysCount) / previous7DaysCount * 100
      : 0;

    return NextResponse.json({
      metrics: aggregated,
      daily_metrics: metrics || [],
      recent_audits: recentAudits || [],
      trends: {
        audits_completed: trend,
      },
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        days: Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in auditor performance API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

