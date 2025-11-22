/**
 * Resolve Fraud Case API
 * PUT /api/fraud/[id]/resolve
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { resolution_notes, status, penalty_amount, refund_issued, actions_taken } = await request.json();

    if (!resolution_notes) {
      return NextResponse.json({ error: 'Resolution notes are required' }, { status: 400 });
    }

    const { data: fraudCase, error } = await supabase
      .from('fraud_cases')
      .update({
        status: status || 'RESOLVED',
        resolution_notes,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        investigation_completed_at: new Date().toISOString(),
        penalty_amount: penalty_amount !== undefined ? penalty_amount : 0,
        refund_issued: refund_issued !== undefined ? refund_issued : 0,
        actions_taken: actions_taken || [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error resolving fraud case:', error);
      return NextResponse.json({ error: 'Failed to resolve fraud case' }, { status: 500 });
    }

    return NextResponse.json({ success: true, case: fraudCase });
  } catch (error) {
    console.error('Error in PUT /api/fraud/[id]/resolve:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

