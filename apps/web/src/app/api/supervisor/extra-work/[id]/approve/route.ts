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

    // Get user profile with role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, workshop_id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is supervisor
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_SUPERVISOR') {
      return NextResponse.json({ error: 'Forbidden: Supervisor only' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { notes, approved_amount } = body;

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
    const finalAmount = approved_amount || extraWork.amount;

    // Approve extra work request
    const { data: updatedExtraWork, error: updateError } = await supabase
      .from('lead_extra_charges')
      .update({
        status: 'APPROVED',
        approved_by: userProfile.id,
        supervisor_approved_by: userProfile.id,
        approved_at: now,
        approval_responded_at: now,
        supervisor_approval_notes: notes || 'Approved by supervisor',
        amount: finalAmount,
        updated_at: now
      })
      .eq('id', extraWorkId)
      .select()
      .single();

    if (updateError) {
      console.error('Error approving extra work:', updateError);
      return NextResponse.json({ error: 'Failed to approve extra work' }, { status: 500 });
    }

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: extraWork.lead_id,
        user_id: userProfile.id,
        activity_type: 'EXTRA_WORK_APPROVED',
        description: `Supervisor approved extra work: ${extraWork.description}`,
        metadata: {
          supervisor_id: userProfile.id,
          extra_work_id: extraWorkId,
          requested_amount: extraWork.amount,
          approved_amount: finalAmount,
          approved_at: now,
          notes: notes
        }
      });

    // Create supervisor action log
    await supabase
      .from('supervisor_actions')
      .insert({
        lead_id: extraWork.lead_id,
        supervisor_id: userProfile.id,
        action_type: 'EXTRA_WORK_APPROVED',
        action_data: {
          extra_work_id: extraWorkId,
          requested_amount: extraWork.amount,
          approved_amount: finalAmount,
          description: extraWork.description
        },
        notes: notes,
        created_at: now
      });

    // TODO: Send notification to mechanic (approval confirmed)
    // TODO: Send notification to workshop admin
    // TODO: Update estimated cost for lead

    return NextResponse.json({
      success: true,
      message: 'Extra work approved successfully',
      extra_work: updatedExtraWork,
      approved_amount: finalAmount,
      next_step: 'Mechanic can proceed with the additional work'
    }, { status: 200 });

  } catch (error) {
    console.error('Error in approve extra work API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

