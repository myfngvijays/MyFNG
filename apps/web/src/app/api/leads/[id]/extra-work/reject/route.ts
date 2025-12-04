import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/leads/[id]/extra-work/reject
 * 
 * Reject extra work charges (Supervisor action)
 * 
 * Body:
 * - charge_id: UUID of the extra charge to reject
 * - reason: Reason for rejection (required)
 * - notes: Optional additional notes
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to verify supervisor role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, workshop_id, full_name, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify supervisor role
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_SUPERVISOR') {
      return NextResponse.json({ error: 'Forbidden: Supervisor role required' }, { status: 403 });
    }

    const leadId = params.id;
    const { charge_id, reason, notes } = await request.json();

    if (!charge_id) {
      return NextResponse.json({ error: 'charge_id is required' }, { status: 400 });
    }

    if (!reason || reason.trim() === '') {
      return NextResponse.json({ error: 'reason is required for rejection' }, { status: 400 });
    }

    // Fetch the extra charge
    const { data: extraCharge, error: chargeError } = await supabase
      .from('lead_extra_charges')
      .select('*')
      .eq('id', charge_id)
      .eq('lead_id', leadId)
      .single();

    if (chargeError || !extraCharge) {
      console.error('Error fetching extra charge:', chargeError);
      return NextResponse.json({ 
        error: 'Extra charge not found',
        details: chargeError?.message 
      }, { status: 404 });
    }

    // Fetch lead to verify workshop ownership
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('workshop_id')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      console.error('Error fetching lead:', leadError);
      return NextResponse.json({ 
        error: 'Lead not found',
        details: leadError?.message 
      }, { status: 404 });
    }

    // Verify workshop ownership
    if (lead.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Forbidden: Lead belongs to different workshop' }, { status: 403 });
    }

    // Check if already approved or rejected
    if (extraCharge.status !== 'PENDING') {
      return NextResponse.json({ 
        error: `Extra charge already ${extraCharge.status.toLowerCase()}` 
      }, { status: 400 });
    }

    // Reject the extra charge
    const combinedNotes = reason + (notes ? `\n\nAdditional notes: ${notes}` : '');
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('lead_extra_charges')
      .update({
        status: 'REJECTED',
        supervisor_approved_by: userProfile.id,
        supervisor_approval_notes: combinedNotes,
        approval_responded_at: now
      })
      .eq('id', charge_id);

    if (updateError) {
      console.error('Error rejecting extra charge:', updateError);
      console.error('Update error details:', {
        code: updateError.code,
        message: updateError.message,
        hint: updateError.hint,
        details: updateError.details
      });
      return NextResponse.json({ 
        error: 'Failed to reject extra charge',
        details: updateError.message,
        code: updateError.code
      }, { status: 500 });
    }

    // Log activity (don't fail request if logging fails)
    try {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'EXTRA_WORK_REJECTED',
        description: `Extra work charge of ₹${extraCharge.amount} rejected by supervisor ${userProfile.full_name}. Reason: ${reason}`,
        metadata: {
          charge_id: charge_id,
          amount: extraCharge.amount,
          description: extraCharge.description,
          rejection_reason: reason,
          notes: notes,
          supervisor_id: userProfile.id
        }
      });
    } catch (logError) {
      // Log activity error but don't fail the request
      console.error('Error logging activity:', logError);
    }

    return NextResponse.json({
      success: true,
      message: 'Extra work rejected successfully',
      data: {
        chargeId: charge_id,
        amount: extraCharge.amount,
        description: extraCharge.description,
        reason
      }
    });

  } catch (error: any) {
    console.error('Reject extra work API error:', error);
    return NextResponse.json(
      { error: 'Failed to reject extra work', details: error.message },
      { status: 500 }
    );
  }
}

