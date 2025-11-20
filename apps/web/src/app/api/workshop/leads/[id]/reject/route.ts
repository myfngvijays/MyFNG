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
      .select('id, role, workshop_id')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is workshop admin
    if (userProfile.role !== 'workshop_admin') {
      return NextResponse.json({ error: 'Forbidden: Workshop Admin only' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { reason, notes } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    const leadId = params.id;

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Verify lead is assigned to this workshop
    if (lead.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Lead not assigned to your workshop' }, { status: 403 });
    }

    // Verify lead is in correct status
    if (lead.status !== 'ASSIGNED_TO_WORKSHOP' && lead.status !== 'PENDING') {
      return NextResponse.json({ 
        error: 'Lead cannot be rejected in current status',
        current_status: lead.status 
      }, { status: 400 });
    }

    // Update lead status to REJECTED
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        status: 'REJECTED',
        rejected_at: new Date().toISOString(),
        rejected_reason: reason,
        rejection_notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error rejecting lead:', updateError);
      return NextResponse.json({ error: 'Failed to reject lead' }, { status: 500 });
    }

    // Log status change in lead_status_history
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'REJECTED',
        changed_by: userProfile.id,
        changed_at: new Date().toISOString(),
        reason: reason,
        notes: notes || 'Lead rejected by workshop admin'
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'LEAD_REJECTED',
        description: `Workshop admin rejected the lead: ${reason}`,
        old_status: lead.status,
        new_status: 'REJECTED',
        metadata: {
          workshop_id: userProfile.workshop_id,
          rejected_by: userProfile.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
          rejection_notes: notes
        }
      });

    // TODO: Notify Lead Manager for reassignment
    // TODO: Send notification to customer

    return NextResponse.json({
      success: true,
      message: 'Lead rejected successfully',
      lead: updatedLead,
      next_step: 'Lead will be reassigned by Lead Manager to another workshop'
    }, { status: 200 });

  } catch (error) {
    console.error('Error in reject lead API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

