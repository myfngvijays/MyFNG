/**
 * Mechanic Performance Metrics API
 * Purpose: Get performance metrics for a mechanic
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mechanicId = params.id;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Get metrics for date range
    let query = supabase
      .from('mechanic_performance_metrics')
      .select('*')
      .eq('mechanic_id', mechanicId)
      .order('date', { ascending: false })
      .limit(30);

    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    } else {
      query = query.eq('date', date);
    }

    const { data: metrics, error: metricsError } = await query;

    if (metricsError) {
      console.error('Error fetching mechanic metrics:', metricsError);
      return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
    }

    // Calculate totals if multiple dates
    const totals = metrics?.reduce((acc, m) => ({
      jobs_assigned: acc.jobs_assigned + (m.jobs_assigned || 0),
      jobs_completed: acc.jobs_completed + (m.jobs_completed || 0),
      total_work_hours: acc.total_work_hours + parseFloat(m.total_work_hours || '0'),
      avg_completion_time: acc.avg_completion_time + parseFloat(m.avg_completion_time_hours || '0'),
    }), {
      jobs_assigned: 0,
      jobs_completed: 0,
      total_work_hours: 0,
      avg_completion_time: 0,
    }) || {
      jobs_assigned: 0,
      jobs_completed: 0,
      total_work_hours: 0,
      avg_completion_time: 0,
    };

    if (metrics && metrics.length > 0) {
      totals.avg_completion_time = totals.avg_completion_time / metrics.length;
    }

    return NextResponse.json({
      success: true,
      metrics: metrics || [],
      totals: totals,
      period: startDate && endDate ? { start: startDate, end: endDate } : { date: date },
    }, { status: 200 });

  } catch (error) {
    console.error('Error in mechanic metrics API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

