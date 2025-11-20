/**
 * Refund Requests API
 * GET /api/refunds - List refunds
 * POST /api/refunds - Create refund request
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreateRefundRequestInput } from '@/shared/types/financial';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const workshop_id = searchParams.get('workshop_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('refund_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (workshop_id) query = query.eq('workshop_id', workshop_id);

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching refunds:', error);
      return NextResponse.json({ error: 'Failed to fetch refunds' }, { status: 500 });
    }

    return NextResponse.json({
      refunds: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    });
  } catch (error) {
    console.error('Error in GET /api/refunds:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateRefundRequestInput = await request.json();

    if (!body.lead_id || !body.reason || body.amount === undefined) {
      return NextResponse.json(
        { error: 'lead_id, amount, and reason are required' },
        { status: 400 }
      );
    }

    const { data: refund, error } = await supabase
      .from('refund_requests')
      .insert({
        lead_id: body.lead_id,
        customer_id: body.customer_id || null,
        workshop_id: body.workshop_id || null,
        amount: body.amount,
        original_amount: body.original_amount,
        refund_type: body.refund_type || 'FULL',
        reason: body.reason,
        reason_category: body.reason_category || null,
        customer_remarks: body.customer_remarks || null,
        attachments: body.attachments || [],
        complaint_id: body.complaint_id || null,
        status: 'PENDING',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating refund:', error);
      return NextResponse.json({ error: 'Failed to create refund' }, { status: 500 });
    }

    return NextResponse.json({ success: true, refund }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/refunds:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

