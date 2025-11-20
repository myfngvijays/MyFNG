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

    // Verify user is CSE
    if (userProfile.role !== 'cse') {
      return NextResponse.json({ error: 'Forbidden: CSE only' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { 
      followup_type, 
      customer_response, 
      satisfaction_score, 
      service_quality_rating,
      issues_reported, 
      resolution_provided,
      would_recommend,
      feedback_text,
      call_duration,
      escalated,
      escalation_reason 
    } = body;

    if (!followup_type || !['POST_SERVICE', 'PAYMENT_REMINDER', 'ISSUE_RESOLUTION', 'SATISFACTION_CHECK'].includes(followup_type)) {
      return NextResponse.json({ error: 'Invalid followup type' }, { status: 400 });
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

    const now = new Date().toISOString();

    // Create follow-up record
    const { data: followup, error: followupError } = await supabase
      .from('cse_followups')
      .insert({
        lead_id: leadId,
        cse_id: userProfile.id,
        followup_type: followup_type,
        completed_at: now,
        customer_response: customer_response,
        satisfaction_score: satisfaction_score || null,
        service_quality_rating: service_quality_rating || null,
        issues_reported: issues_reported || null,
        resolution_provided: resolution_provided || null,
        resolution_status: issues_reported ? 'PENDING' : 'RESOLVED',
        escalated: escalated || false,
        escalation_reason: escalation_reason || null,
        would_recommend: would_recommend || null,
        feedback_text: feedback_text || null,
        call_duration: call_duration || null,
        created_at: now
      })
      .select()
      .single();

    if (followupError) {
      console.error('Error creating follow-up:', followupError);
      return NextResponse.json({ error: 'Failed to log follow-up' }, { status: 500 });
    }

    // Update lead with CSE info if not already set
    if (!lead.cse_assigned_id) {
      await supabase
        .from('service_leads')
        .update({
          cse_assigned_id: userProfile.id,
          cse_assigned_at: now
        })
        .eq('id', leadId);
    }

    // If customer has issues and escalation is needed
    if (escalated) {
      await supabase
        .from('service_leads')
        .update({
          escalation: true,
          updated_at: now
        })
        .eq('id', leadId);
    }

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'CSE_FOLLOWUP',
        description: `CSE follow-up completed: ${followup_type}`,
        metadata: {
          cse_id: userProfile.id,
          followup_type: followup_type,
          satisfaction_score: satisfaction_score,
          service_quality_rating: service_quality_rating,
          issues_reported: issues_reported,
          escalated: escalated,
          completed_at: now
        }
      });

    // TODO: If escalated, send notification to Sub Admin
    // TODO: If satisfaction score < 3, create alert

    return NextResponse.json({
      success: true,
      message: 'Follow-up logged successfully',
      followup: followup,
      escalated: escalated,
      next_step: escalated 
        ? 'Issue escalated to management'
        : satisfaction_score && satisfaction_score >= 4
          ? 'Customer satisfied - Ready to close lead'
          : 'Continue monitoring'
    }, { status: 201 });

  } catch (error) {
    console.error('Error in CSE follow-up API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

