/**
 * Workshop Payouts API
 * GET /api/payouts - List payouts
 * POST /api/payouts - Create payout
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreatePayoutInput } from '@/shared/types/financial';

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
      .from('workshop_payouts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (workshop_id) query = query.eq('workshop_id', workshop_id);

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching payouts:', error);
      return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });
    }

    return NextResponse.json({
      payouts: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    });
  } catch (error) {
    console.error('Error in GET /api/payouts:', error);
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

    const body: CreatePayoutInput = await request.json();

    if (!body.workshop_id || !body.payout_period_start || !body.payout_period_end || body.amount === undefined) {
      return NextResponse.json(
        { error: 'workshop_id, amount, payout_period_start, and payout_period_end are required' },
        { status: 400 }
      );
    }

    const { data: payout, error } = await supabase
      .from('workshop_payouts')
      .insert({
        workshop_id: body.workshop_id,
        amount: body.amount,
        payout_period_start: body.payout_period_start,
        payout_period_end: body.payout_period_end,
        total_jobs: body.total_jobs || 0,
        job_ids: body.job_ids || [],
        calculation_breakdown: body.calculation_breakdown || null,
        deductions: body.deductions || null,
        bank_account_number: body.bank_account_number || null,
        bank_ifsc_code: body.bank_ifsc_code || null,
        bank_name: body.bank_name || null,
        status: 'PENDING',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating payout:', error);
      return NextResponse.json({ error: 'Failed to create payout' }, { status: 500 });
    }

    return NextResponse.json({ success: true, payout }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/payouts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

