/**
 * Lead Events API
 * GET /api/audit/events - Fetch all events with filters
 * POST /api/audit/events - Create a new event
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreateLeadEventInput } from '@/shared/types/audit';

/**
 * GET /api/audit/events
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const leadId = searchParams.get('lead_id');
    const eventType = searchParams.get('event_type');
    const createdBy = searchParams.get('created_by');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('lead_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (leadId) query = query.eq('lead_id', leadId);
    if (eventType) query = query.eq('event_type', eventType);
    if (createdBy) query = query.eq('created_by', createdBy);

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching events:', error);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    return NextResponse.json({
      events: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    });
  } catch (error) {
    console.error('Error in GET /api/audit/events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/audit/events
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateLeadEventInput = await request.json();

    if (!body.lead_id || !body.event_type) {
      return NextResponse.json(
        { error: 'Lead ID and event type are required' },
        { status: 400 }
      );
    }

    const { data: event, error } = await supabase
      .from('lead_events')
      .insert({
        lead_id: body.lead_id,
        event_type: body.event_type,
        event_description: body.event_description || null,
        event_data: body.event_data || null,
        old_status: body.old_status || null,
        new_status: body.new_status || null,
        created_by: body.created_by || user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating event:', error);
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }

    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/audit/events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

