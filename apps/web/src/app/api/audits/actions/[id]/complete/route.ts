/**
 * Complete Action Item API
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const actionId = params.id;
    const body = await request.json();
    const { completion_notes, evidence_urls } = body;

    // Get action item
    const { data: actionItem, error: actionError } = await supabase
      .from('audit_action_items')
      .select('*')
      .eq('id', actionId)
      .single();

    if (actionError || !actionItem) {
      return NextResponse.json({ error: 'Action item not found' }, { status: 404 });
    }

    if (actionItem.status === 'COMPLETED') {
      return NextResponse.json({
        error: 'Action item already completed',
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update action item
    const { data: updatedItem, error: updateError } = await supabase
      .from('audit_action_items')
      .update({
        status: 'COMPLETED',
        completion_date: now,
        completion_notes: completion_notes,
        evidence_urls: evidence_urls || [],
        updated_at: now,
      })
      .eq('id', actionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error completing action item:', updateError);
      return NextResponse.json({ error: 'Failed to complete action item' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Action item completed successfully',
      action_item: updatedItem,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in complete action item API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

