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
        error: 'Lead cannot be accepted in current status',
        current_status: lead.status 
      }, { status: 400 });
    }

    // Update lead status to ACCEPTED
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        status: 'ACCEPTED',
        accepted_at: new Date().toISOString(),
        workshop_accepted_by: userProfile.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error accepting lead:', updateError);
      return NextResponse.json({ error: 'Failed to accept lead' }, { status: 500 });
    }

    // Log status change in lead_status_history
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'ACCEPTED',
        changed_by: userProfile.id,
        changed_at: new Date().toISOString(),
        reason: 'Lead accepted by workshop admin',
        notes: 'Workshop has accepted the lead and will assign team members'
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'LEAD_ACCEPTED',
        description: 'Workshop admin accepted the lead',
        old_status: lead.status,
        new_status: 'ACCEPTED',
        metadata: {
          workshop_id: userProfile.workshop_id,
          accepted_by: userProfile.id,
          accepted_at: new Date().toISOString()
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Lead accepted successfully',
      lead: updatedLead,
      next_step: 'Please assign team members (Mechanic, Supervisor, Pickup Boy)'
    }, { status: 200 });

  } catch (error) {
    console.error('Error in accept lead API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

