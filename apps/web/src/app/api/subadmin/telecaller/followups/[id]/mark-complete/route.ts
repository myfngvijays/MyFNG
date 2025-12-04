/**
 * Telecaller Sub Admin Follow-up Mark Complete API
 * POST /api/subadmin/telecaller/followups/[id]/mark-complete
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, department, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const department = userProfile.department;

    if (roleCode !== 'SUB_ADMIN' || department !== 'TELECALLER') {
      return NextResponse.json({ error: 'Forbidden: Telecaller Sub Admin role required' }, { status: 403 });
    }

    const followupId = params.id;
    const body = await request.json();
    const { completion_notes } = body;

    // Get follow-up
    const { data: followup, error: followupError } = await supabase
      .from('telecaller_follow_ups')
      .select('*')
      .eq('id', followupId)
      .single();

    if (followupError || !followup) {
      return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });
    }

    // Mark as complete
    const { data: updatedFollowup, error: updateError } = await supabase
      .from('telecaller_follow_ups')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        completion_notes: completion_notes || `Marked complete by Sub Admin`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', followupId)
      .select()
      .single();

    if (updateError || !updatedFollowup) {
      console.error('Error marking follow-up complete:', updateError);
      return NextResponse.json(
        { error: 'Failed to mark follow-up complete', details: updateError?.message },
        { status: 500 }
      );
    }

    // Log action
    await supabase.from('subadmin_actions').insert({
      subadmin_id: user.id,
      department: 'TELECALLER',
      action_type: 'MARK_FOLLOWUP_COMPLETE',
      action_description: `Marked follow-up ${followupId} as complete`,
      related_entity_type: 'FOLLOWUP',
      related_entity_id: followupId,
      old_status: 'PENDING',
      new_status: 'COMPLETED',
      metadata: {
        completion_notes: completion_notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      followup: updatedFollowup,
      message: 'Follow-up marked as complete',
    });

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/telecaller/followups/[id]/mark-complete:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

