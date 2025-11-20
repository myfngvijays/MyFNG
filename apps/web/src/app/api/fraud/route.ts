/**
 * Fraud Cases API
 * GET /api/fraud - Fetch all fraud cases with filters
 * POST /api/fraud - Report a new fraud case
 */

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { CreateFraudCaseInput, FraudCasesResponse } from '@/shared/types/complaints-fraud';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const caseType = searchParams.get('case_type');
    const workshopId = searchParams.get('workshop_id');
    const investigatorId = searchParams.get('investigator_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('fraud_cases')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);
    if (caseType) query = query.eq('case_type', caseType);
    if (workshopId) query = query.eq('workshop_id', workshopId);
    if (investigatorId) query = query.eq('investigator_id', investigatorId);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching fraud cases:', error);
      return NextResponse.json({ error: 'Failed to fetch fraud cases' }, { status: 500 });
    }

    const response: FraudCasesResponse = {
      cases: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/fraud:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateFraudCaseInput = await request.json();

    if (!body.case_type || !body.fraud_description) {
      return NextResponse.json(
        { error: 'Case type and fraud description are required' },
        { status: 400 }
      );
    }

    // Generate case number
    const caseNumber = `FRD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const { data: fraudCase, error } = await supabase
      .from('fraud_cases')
      .insert({
        case_number: caseNumber,
        case_type: body.case_type,
        severity: body.severity || 'MEDIUM',
        workshop_id: body.workshop_id || null,
        user_id: body.user_id || null,
        lead_id: body.lead_id || null,
        fraud_description: body.fraud_description,
        evidence: body.evidence || [],
        financial_impact: body.financial_impact || 0,
        affected_customers: body.affected_customers || [],
        status: 'REPORTED',
        reported_by: body.reported_by || user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating fraud case:', error);
      return NextResponse.json({ error: 'Failed to create fraud case' }, { status: 500 });
    }

    return NextResponse.json({ success: true, case: fraudCase }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/fraud:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

