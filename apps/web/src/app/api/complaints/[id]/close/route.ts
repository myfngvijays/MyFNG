/**
 * Close Complaint API
 * PUT /api/complaints/[id]/close
 */

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { closure_notes } = await request.json();

    const { data: complaint, error } = await supabase
      .from('customer_complaints')
      .update({
        status: 'CLOSED',
        closed_by: user.id,
        closed_at: new Date().toISOString(),
        closure_notes: closure_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error closing complaint:', error);
      return NextResponse.json({ error: 'Failed to close complaint' }, { status: 500 });
    }

    return NextResponse.json({ success: true, complaint });
  } catch (error) {
    console.error('Error in PUT /api/complaints/[id]/close:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

