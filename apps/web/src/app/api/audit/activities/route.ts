/**
 * Lead Activities API
 * GET /api/audit/activities - Fetch all activities with filters
 * POST /api/audit/activities - Create a new activity
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreateLeadActivityInput } from '@/shared/types/audit';

/**
 * GET /api/audit/activities
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const leadId = searchParams.get('lead_id');
    const userId = searchParams.get('user_id');
    const activityType = searchParams.get('activity_type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('lead_activities')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (leadId) query = query.eq('lead_id', leadId);
    if (userId) query = query.eq('user_id', userId);
    if (activityType) query = query.eq('activity_type', activityType);

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching activities:', error);
      return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
    }

    return NextResponse.json({
      activities: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    });
  } catch (error) {
    console.error('Error in GET /api/audit/activities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/audit/activities
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateLeadActivityInput = await request.json();

    if (!body.activity_type) {
      return NextResponse.json({ error: 'Activity type is required' }, { status: 400 });
    }

    const { data: activity, error } = await supabase
      .from('lead_activities')
      .insert({
        lead_id: body.lead_id || null,
        user_id: body.user_id || user.id,
        activity_type: body.activity_type,
        description: body.description || null,
        old_status: body.old_status || null,
        new_status: body.new_status || null,
        metadata: body.metadata || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating activity:', error);
      return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
    }

    return NextResponse.json({ success: true, activity }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/audit/activities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

