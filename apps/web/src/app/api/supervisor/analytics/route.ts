import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/supervisor/analytics
 * 
 * Get KPI and analytics data for supervisor
 */
export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users_login')
      .select('workshop_id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (!userProfile || (userProfile.roles as any)?.role_code !== 'WORKSHOP_SUPERVISOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const workshopId = userProfile.workshop_id;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // KPI Metrics
    const { data: leads } = await supabase
      .from('service_leads')
      .select('*')
      .eq('workshop_id', workshopId)
      .gte('created_at', startDate.toISOString());

    const { count: totalJobs } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .eq('workshop_id', workshopId)
      .gte('created_at', startDate.toISOString());

    const { count: completedJobs } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .eq('workshop_id', workshopId)
      .eq('status', 'COMPLETED')
      .gte('updated_at', startDate.toISOString());

    const { count: slaBreaches } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .eq('workshop_id', workshopId)
      .eq('sla_status', 'BREACHED')
      .gte('created_at', startDate.toISOString());

    const { data: qcData } = await supabase
      .from('qc_checks')
      .select('qc_status')
      .gte('created_at', startDate.toISOString());

    const qcPassed = qcData?.filter(q => q.qc_status === 'PASSED').length || 0;
    const qcFailed = qcData?.filter(q => q.qc_status === 'FAILED').length || 0;
    const qcTotal = qcPassed + qcFailed;
    const qcPassRate = qcTotal > 0 ? Math.round((qcPassed / qcTotal) * 100) : 0;

    const slaCompliance = totalJobs && slaBreaches ? 
      Math.round(((totalJobs - slaBreaches) / totalJobs) * 100) : 100;

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalJobs: totalJobs || 0,
          completedJobs: completedJobs || 0,
          avgCompletionTime: 24, // hours - calculate from data
          qcPassRate,
          slaCompliance,
          pendingApprovals: 5 // from extra charges
        },
        charts: {
          statusDistribution: leads ? leads.reduce((acc: any, lead: any) => {
            acc[lead.status] = (acc[lead.status] || 0) + 1;
            return acc;
          }, {}) : {},
          dailyThroughput: [] // Calculate daily stats
        }
      }
    });

  } catch (error: any) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: error.message },
      { status: 500 }
    );
  }
}

