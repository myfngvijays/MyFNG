/**
 * Assign Complaint API
 * PUT /api/complaints/[id]/assign
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
    const { assigned_to } = await request.json();

    if (!assigned_to) {
      return NextResponse.json({ error: 'assigned_to is required' }, { status: 400 });
    }

    const { data: complaint, error } = await supabase
      .from('customer_complaints')
      .update({
        assigned_to,
        assigned_at: new Date().toISOString(),
        status: 'ACKNOWLEDGED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error assigning complaint:', error);
      return NextResponse.json({ error: 'Failed to assign complaint' }, { status: 500 });
    }

    return NextResponse.json({ success: true, complaint });
  } catch (error) {
    console.error('Error in PUT /api/complaints/[id]/assign:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

