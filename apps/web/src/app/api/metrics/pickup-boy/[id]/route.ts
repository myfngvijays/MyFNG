/**
 * Pickup Boy Performance Metrics API
 * Purpose: Get performance metrics for a pickup boy
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

    const pickupBoyId = params.id;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Get metrics for date range
    let query = supabase
      .from('pickup_boy_metrics')
      .select('*')
      .eq('pickup_boy_id', pickupBoyId)
      .order('date', { ascending: false })
      .limit(30);

    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    } else {
      query = query.eq('date', date);
    }

    const { data: metrics, error: metricsError } = await query;

    if (metricsError) {
      console.error('Error fetching pickup boy metrics:', metricsError);
      return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
    }

    // Calculate totals
    const totals = metrics?.reduce((acc, m) => ({
      total_pickups: acc.total_pickups + (m.total_pickups || 0),
      completed_pickups: acc.completed_pickups + (m.completed_pickups || 0),
      total_drops: acc.total_drops + (m.total_drops || 0),
      completed_drops: acc.completed_drops + (m.completed_drops || 0),
      distance_traveled: acc.distance_traveled + parseFloat(m.distance_traveled || '0'),
    }), {
      total_pickups: 0,
      completed_pickups: 0,
      total_drops: 0,
      completed_drops: 0,
      distance_traveled: 0,
    }) || {
      total_pickups: 0,
      completed_pickups: 0,
      total_drops: 0,
      completed_drops: 0,
      distance_traveled: 0,
    };

    return Response.json({
      success: true,
      metrics: metrics || [],
      totals: totals,
      period: startDate && endDate ? { start: startDate, end: endDate } : { date: date },
    }, { status: 200 });

  } catch (error) {
    console.error('Error in pickup boy metrics API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

