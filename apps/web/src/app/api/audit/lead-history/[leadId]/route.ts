/**
 * Lead History API
 * GET /api/audit/lead-history/[leadId] - Get complete history for a lead
 */

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { leadId } = params;

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    // Fetch all history data in parallel
    const [statusHistoryRes, activitiesRes, eventsRes] = await Promise.all([
      // 1. Status History
      supabase
        .from('lead_status_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('changed_at', { ascending: false }),
      
      // 2. Activities
      supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false }),
      
      // 3. Events
      supabase
        .from('lead_events')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false }),
    ]);

    // Check for errors
    if (statusHistoryRes.error) {
      console.error('Error fetching status history:', statusHistoryRes.error);
    }
    if (activitiesRes.error) {
      console.error('Error fetching activities:', activitiesRes.error);
    }
    if (eventsRes.error) {
      console.error('Error fetching events:', eventsRes.error);
    }

    return NextResponse.json({
      lead_id: leadId,
      status_history: statusHistoryRes.data || [],
      activities: activitiesRes.data || [],
      events: eventsRes.data || [],
    });
  } catch (error) {
    console.error('Error in GET /api/audit/lead-history/[leadId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

