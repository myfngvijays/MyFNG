/**
 * Single Fraud Case API
 * GET /api/fraud/[id] - Get fraud case details
 * PUT /api/fraud/[id] - Update fraud case
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { UpdateFraudCaseInput } from '@/shared/types/complaints-fraud';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const { data: fraudCase, error } = await supabase
      .from('fraud_cases')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !fraudCase) {
      return NextResponse.json({ error: 'Fraud case not found' }, { status: 404 });
    }

    return NextResponse.json({ case: fraudCase });
  } catch (error) {
    console.error('Error in GET /api/fraud/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body: UpdateFraudCaseInput = await request.json();

    const updateData: any = { ...body, updated_at: new Date().toISOString() };

    const { data: fraudCase, error } = await supabase
      .from('fraud_cases')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating fraud case:', error);
      return NextResponse.json({ error: 'Failed to update fraud case' }, { status: 500 });
    }

    return NextResponse.json({ success: true, case: fraudCase });
  } catch (error) {
    console.error('Error in PUT /api/fraud/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

