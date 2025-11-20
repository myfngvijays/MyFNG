/**
 * Customer Complaints API
 * GET /api/complaints - Fetch all complaints with filters
 * POST /api/complaints - Create a new complaint
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreateComplaintInput, ComplaintsResponse } from '@/shared/types/complaints-fraud';

/**
 * GET /api/complaints
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const priority = searchParams.get('priority');
    const complaintType = searchParams.get('complaint_type');
    const workshopId = searchParams.get('workshop_id');
    const customerId = searchParams.get('customer_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('customer_complaints')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);
    if (priority) query = query.eq('priority', priority);
    if (complaintType) query = query.eq('complaint_type', complaintType);
    if (workshopId) query = query.eq('workshop_id', workshopId);
    if (customerId) query = query.eq('customer_id', customerId);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching complaints:', error);
      return NextResponse.json({ error: 'Failed to fetch complaints' }, { status: 500 });
    }

    const response: ComplaintsResponse = {
      complaints: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/complaints:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/complaints
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateComplaintInput = await request.json();

    // Validate required fields
    if (!body.complaint_type || !body.description) {
      return NextResponse.json(
        { error: 'Complaint type and description are required' },
        { status: 400 }
      );
    }

    // Generate complaint number
    const complaintNumber = `CMP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const { data: complaint, error } = await supabase
      .from('customer_complaints')
      .insert({
        complaint_number: complaintNumber,
        lead_id: body.lead_id || null,
        customer_id: body.customer_id || user.id,
        workshop_id: body.workshop_id || null,
        mechanic_id: body.mechanic_id || null,
        pickup_boy_id: body.pickup_boy_id || null,
        complaint_type: body.complaint_type,
        complaint_category: body.complaint_category || null,
        severity: body.severity || 'MEDIUM',
        priority: body.priority || 'NORMAL',
        description: body.description,
        customer_expected_resolution: body.customer_expected_resolution || null,
        attachments: body.attachments || [],
        status: 'OPEN',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating complaint:', error);
      return NextResponse.json({ error: 'Failed to create complaint' }, { status: 500 });
    }

    return NextResponse.json({ success: true, complaint }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/complaints:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

