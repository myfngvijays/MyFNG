/**
 * Resolve Complaint API
 * PUT /api/complaints/[id]/resolve
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { resolution, resolution_action_taken, customer_satisfied, customer_feedback } = await request.json();

    if (!resolution) {
      return NextResponse.json({ error: 'Resolution is required' }, { status: 400 });
    }

    const { data: complaint, error } = await supabase
      .from('customer_complaints')
      .update({
        resolution,
        resolution_action_taken: resolution_action_taken || null,
        customer_satisfied: customer_satisfied !== undefined ? customer_satisfied : null,
        customer_feedback: customer_feedback || null,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        status: 'RESOLVED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error resolving complaint:', error);
      return NextResponse.json({ error: 'Failed to resolve complaint' }, { status: 500 });
    }

    return NextResponse.json({ success: true, complaint });
  } catch (error) {
    console.error('Error in PUT /api/complaints/[id]/resolve:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

