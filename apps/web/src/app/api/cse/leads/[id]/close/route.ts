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

    // Verify user is CSE or admin
    const allowedRoles = ['cse', 'super_admin', 'sub_admin'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { 
      closure_notes, 
      customer_satisfaction_score,
      final_feedback 
    } = body;

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

    // Verify lead is in closable status
    const validStatuses = ['PAYMENT_COMPLETED', 'COMPLETED'];
    if (!validStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: 'Lead cannot be closed in current status',
        current_status: lead.status,
        hint: 'Lead must have completed payment'
      }, { status: 400 });
    }

    // Check if payment is complete
    if (lead.payment_status !== 'PAID') {
      return NextResponse.json({ 
        error: 'Payment must be completed before closing lead',
        payment_status: lead.payment_status
      }, { status: 400 });
    }

    // Check if CSE follow-up exists
    const { data: followups, count: followupCount } = await supabase
      .from('cse_followups')
      .select('*', { count: 'exact' })
      .eq('lead_id', leadId);

    if (!followupCount || followupCount === 0) {
      return NextResponse.json({ 
        error: 'At least one CSE follow-up is required before closing lead',
        hint: 'Complete a follow-up call first'
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Close the lead
    const { data: closedLead, error: closeError } = await supabase
      .from('service_leads')
      .update({
        status: 'CLOSED',
        closed_by: userProfile.id,
        final_closure_at: now,
        customer_satisfaction_score: customer_satisfaction_score || null,
        cse_followup_completed: true,
        cse_followup_notes: closure_notes || final_feedback,
        updated_at: now
      })
      .eq('id', leadId)
      .select()
      .single();

    if (closeError) {
      console.error('Error closing lead:', closeError);
      return NextResponse.json({ error: 'Failed to close lead' }, { status: 500 });
    }

    // Log status change
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'CLOSED',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Lead closed by CSE after successful completion',
        notes: closure_notes || 'Lead closed successfully'
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'LEAD_CLOSED',
        description: 'Lead closed by CSE',
        old_status: lead.status,
        new_status: 'CLOSED',
        metadata: {
          cse_id: userProfile.id,
          closed_at: now,
          customer_satisfaction_score: customer_satisfaction_score,
          closure_notes: closure_notes,
          final_feedback: final_feedback
        }
      });

    // Calculate total duration
    const createdAt = new Date(lead.created_at);
    const closedAt = new Date(now);
    const totalDurationHours = Math.floor((closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60));

    // TODO: Update workshop performance metrics
    // TODO: Update mechanic performance metrics
    // TODO: Queue workshop payout
    // TODO: Send thank you message to customer
    // TODO: Request review/rating

    return NextResponse.json({
      success: true,
      message: 'Lead closed successfully',
      lead: closedLead,
      summary: {
        lead_number: lead.lead_number,
        customer: lead.customer_name,
        workshop: lead.workshop_id,
        created_at: lead.created_at,
        closed_at: now,
        total_duration_hours: totalDurationHours,
        customer_satisfaction: customer_satisfaction_score,
        final_amount: lead.invoice_amount || lead.final_amount
      },
      message_to_display: '🎉 Lead completed successfully! Thank you for using our service.'
    }, { status: 200 });

  } catch (error) {
    console.error('Error in close lead API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

