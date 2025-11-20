/**
 * Single Complaint API
 * GET /api/complaints/[id] - Get complaint details
 * PUT /api/complaints/[id] - Update complaint
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { UpdateComplaintInput } from '@/shared/types/complaints-fraud';

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

    const { data: complaint, error } = await supabase
      .from('customer_complaints')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    return NextResponse.json({ complaint });
  } catch (error) {
    console.error('Error in GET /api/complaints/[id]:', error);
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
    const body: UpdateComplaintInput = await request.json();

    const updateData: any = { ...body, updated_at: new Date().toISOString() };

    const { data: complaint, error } = await supabase
      .from('customer_complaints')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating complaint:', error);
      return NextResponse.json({ error: 'Failed to update complaint' }, { status: 500 });
    }

    return NextResponse.json({ success: true, complaint });
  } catch (error) {
    console.error('Error in PUT /api/complaints/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

