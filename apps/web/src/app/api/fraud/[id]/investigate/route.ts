/**
 * Investigate Fraud Case API
 * PUT /api/fraud/[id]/investigate
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
    const { investigation_notes } = await request.json();

    const { data: fraudCase, error } = await supabase
      .from('fraud_cases')
      .update({
        status: 'INVESTIGATING',
        investigator_id: user.id,
        investigation_started_at: new Date().toISOString(),
        investigation_notes: investigation_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error starting investigation:', error);
      return NextResponse.json({ error: 'Failed to start investigation' }, { status: 500 });
    }

    return NextResponse.json({ success: true, case: fraudCase });
  } catch (error) {
    console.error('Error in PUT /api/fraud/[id]/investigate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

