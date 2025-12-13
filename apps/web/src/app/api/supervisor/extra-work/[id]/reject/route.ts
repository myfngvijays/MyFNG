import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

    // Get user profile with role (prefer email lookup; fallback to id)
    const { data: userProfileByEmail } = await supabase
      .from('users_login')
      .select('id, email, role, workshop_id, roles!inner(role_code)')
      .eq('email', user.email)
      .maybeSingle();

    const { data: userProfileById, error: profileErrorById } = !userProfileByEmail
      ? await supabase
          .from('users_login')
          .select('id, email, role, workshop_id, roles!inner(role_code)')
          .eq('id', user.id)
          .maybeSingle()
      : { data: null, error: null };

    const userProfile = userProfileByEmail || userProfileById;

    if (!userProfile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          hint: 'No matching users_login row for this session user',
          user_email: user.email,
          profile_lookup_error: profileErrorById?.message,
        },
        { status: 404 }
      );
    }

    // Verify user is supervisor
    const roleCode = (userProfile.roles as any)?.role_code;
    const legacyRole = (userProfile as any)?.role;
    if (roleCode !== 'WORKSHOP_SUPERVISOR' && legacyRole !== 'workshop_supervisor') {
      return NextResponse.json({ error: 'Forbidden: Supervisor only' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { reason, notes } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    const extraWorkId = params.id;

    // Get extra work request details
    const { data: extraWork, error: extraWorkError } = await supabase
      .from('lead_extra_charges')
      .select('*, service_leads!inner(workshop_id, assigned_mechanic_id)')
      .eq('id', extraWorkId)
      .single();

    if (extraWorkError || !extraWork) {
      return NextResponse.json({ error: 'Extra work request not found' }, { status: 404 });
    }

    // Verify extra work is from this workshop
    if (extraWork.service_leads.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Extra work request not in your workshop' }, { status: 403 });
    }

    // Verify status is PENDING
    if (extraWork.status !== 'PENDING') {
      return NextResponse.json({ 
        error: 'Extra work request is not pending',
        current_status: extraWork.status
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Reject extra work request
    const { data: updatedExtraWork, error: updateError } = await supabase
      .from('lead_extra_charges')
      .update({
        status: 'REJECTED',
        approved_by: userProfile.id,
        supervisor_approved_by: userProfile.id,
        approval_responded_at: now,
        rejection_reason: reason,
        supervisor_approval_notes: notes || reason,
        updated_at: now
      })
      .eq('id', extraWorkId)
      .select()
      .single();

    if (updateError) {
      console.error('Error rejecting extra work:', updateError);
      return NextResponse.json({ error: 'Failed to reject extra work' }, { status: 500 });
    }

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: extraWork.lead_id,
        user_id: userProfile.id,
        activity_type: 'EXTRA_WORK_REJECTED',
        description: `Supervisor rejected extra work: ${reason}`,
        metadata: {
          supervisor_id: userProfile.id,
          extra_work_id: extraWorkId,
          requested_amount: extraWork.amount,
          rejection_reason: reason,
          rejected_at: now,
          notes: notes
        }
      });

    // Create supervisor action log
    await supabase
      .from('supervisor_actions')
      .insert({
        lead_id: extraWork.lead_id,
        supervisor_id: userProfile.id,
        action_type: 'EXTRA_WORK_REJECTED',
        action_data: {
          extra_work_id: extraWorkId,
          requested_amount: extraWork.amount,
          description: extraWork.description,
          rejection_reason: reason
        },
        notes: notes,
        created_at: now
      });

    // TODO: Send notification to mechanic (rejection notice)
    // TODO: Send notification to workshop admin

    return NextResponse.json({
      success: true,
      message: 'Extra work rejected',
      extra_work: updatedExtraWork,
      rejection_reason: reason,
      next_step: 'Mechanic has been notified of the rejection'
    }, { status: 200 });

  } catch (error) {
    console.error('Error in reject extra work API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

