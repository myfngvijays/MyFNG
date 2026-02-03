/**
 * Auditor Performance Metrics API
 * Purpose: Get performance metrics for an auditor
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auditorId = params.id;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Get metrics for date range
    let query = supabase
      .from('auditor_performance_metrics')
      .select('*')
      .eq('auditor_id', auditorId)
      .order('date', { ascending: false })
      .limit(30);

    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    } else {
      query = query.eq('date', date);
    }

    const { data: metrics, error: metricsError } = await query;

    if (metricsError) {
      console.error('Error fetching auditor metrics:', metricsError);
      return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
    }

    // Calculate totals
    const totals = metrics?.reduce((acc, m) => ({
      audits_scheduled: acc.audits_scheduled + (m.audits_scheduled || 0),
      audits_completed: acc.audits_completed + (m.audits_completed || 0),
      workshops_passed: acc.workshops_passed + (m.workshops_passed || 0),
      workshops_failed: acc.workshops_failed + (m.workshops_failed || 0),
      action_items_created: acc.action_items_created + (m.action_items_created || 0),
      action_items_verified: acc.action_items_verified + (m.action_items_verified || 0),
    }), {
      audits_scheduled: 0,
      audits_completed: 0,
      workshops_passed: 0,
      workshops_failed: 0,
      action_items_created: 0,
      action_items_verified: 0,
    }) || {
      audits_scheduled: 0,
      audits_completed: 0,
      workshops_passed: 0,
      workshops_failed: 0,
      action_items_created: 0,
      action_items_verified: 0,
    };

    return NextResponse.json({
      success: true,
      metrics: metrics || [],
      totals: totals,
      period: startDate && endDate ? { start: startDate, end: endDate } : { date: date },
    }, { status: 200 });

  } catch (error) {
    console.error('Error in auditor metrics API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

