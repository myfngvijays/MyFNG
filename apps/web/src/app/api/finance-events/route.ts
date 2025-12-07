import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/finance-events
 * Get finance events (audit trail) with filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const entity_type = searchParams.get('entity_type');
    const event_type = searchParams.get('event_type');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('finance_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (entity_type && entity_type !== 'ALL') {
      query = query.eq('entity_type', entity_type);
    }

    if (event_type && event_type !== 'ALL') {
      query = query.eq('event_type', event_type);
    }

    if (date_from) {
      query = query.gte('created_at', `${date_from}T00:00:00`);
    }

    if (date_to) {
      query = query.lte('created_at', `${date_to}T23:59:59`);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Error fetching finance events:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch events',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      events: events || []
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

