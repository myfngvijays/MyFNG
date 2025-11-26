/**
 * Complete Follow-up API
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const followUpId = params.id;
    const body = await request.json();
    const { completion_notes } = body;

    // Get follow-up
    const { data: followUp, error: followUpError } = await supabase
      .from('telecaller_follow_ups')
      .select('*')
      .eq('id', followUpId)
      .single();

    if (followUpError || !followUp) {
      return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });
    }

    if (followUp.status === 'COMPLETED') {
      return NextResponse.json({
        error: 'Follow-up already completed',
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update follow-up
    const { data: updatedFollowUp, error: updateError } = await supabase
      .from('telecaller_follow_ups')
      .update({
        status: 'COMPLETED',
        completed_at: now,
        completed_by: userProfile.id,
        completion_notes: completion_notes,
        updated_at: now,
      })
      .eq('id', followUpId)
      .select()
      .single();

    if (updateError) {
      console.error('Error completing follow-up:', updateError);
      return NextResponse.json({ error: 'Failed to complete follow-up' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Follow-up completed successfully',
      follow_up: updatedFollowUp,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in complete follow-up API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

