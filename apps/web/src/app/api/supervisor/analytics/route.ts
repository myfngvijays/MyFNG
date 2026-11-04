import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { istDayBounds } from '@/lib/telecaller/crmDateRange';

export const dynamic = 'force-dynamic';

/**
 * GET /api/supervisor/analytics
 * 
 * Get KPI and analytics data for supervisor
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const preset = String(searchParams.get('preset') || '').toLowerCase();
    const fromParam = String(searchParams.get('from') || '').slice(0, 10);
    const toParam = String(searchParams.get('to') || '').slice(0, 10);
    const allTime = preset === 'all_time';
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
    let startIso = startDate.toISOString();
    let endIso = new Date().toISOString();
    if (allTime) {
      startIso = '';
      endIso = '';
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
      const from = fromParam <= toParam ? fromParam : toParam;
      const to = fromParam <= toParam ? toParam : fromParam;
      startIso = new Date(istDayBounds(from).start).toISOString();
      endIso = new Date(istDayBounds(to).end).toISOString();
    }

    const bound = (query: any, column: string) => {
      if (!startIso) return query;
      return query.gte(column, startIso).lte(column, endIso);
    };

    // KPI Metrics
    const { data: leads } = await bound(
      supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', workshopId)
        .is('deleted_at', null),
      'created_at',
    );

    const { count: totalJobs } = await bound(
      supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .is('deleted_at', null),
      'created_at',
    );

    const { count: completedJobs } = await bound(
      supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .is('deleted_at', null)
        .eq('status', 'COMPLETED'),
      'updated_at',
    );

    const { count: slaBreaches } = await bound(
      supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .is('deleted_at', null)
        .eq('sla_status', 'BREACHED'),
      'created_at',
    );

    const { data: qcData } = await bound(
      supabase.from('qc_checks').select('qc_status'),
      'created_at',
    );

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

