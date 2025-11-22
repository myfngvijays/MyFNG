/**
 * CSE Final Call API
 * POST /api/cse/leads/[id]/final-call
 * 
 * Log CSE final call with customer and collect feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface FinalCallRequest {
  call_duration?: number; // in seconds
  customer_satisfaction_score?: number; // 1-5
  customer_feedback?: string;
  issues_resolved?: string[];
  pending_issues?: string;
  call_notes?: string;
  follow_up_required?: boolean;
  next_follow_up_at?: string;
}

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
      .select('id, role_id, full_name, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify CSE role
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'CSE' && roleCode !== 'CUSTOMER_SERVICE_EXECUTIVE') {
      return NextResponse.json({ error: 'Forbidden: CSE role required' }, { status: 403 });
    }

    const leadId = params.id;
    const body: FinalCallRequest = await request.json();

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Validate lead status
    const validStatuses = ['COMPLETED', 'DELIVERED', 'PAYMENT_COMPLETED', 'INVOICE_GENERATED', 'AWAITING_PAYMENT'];
    if (!validStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: 'Invalid lead status for final call',
        current_status: lead.status,
        hint: 'Lead must be completed or in payment/delivery stage'
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update lead with CSE follow-up data
    const updateData: any = {
      cse_assigned_id: userProfile.id,
      cse_followup_completed: true,
      cse_followup_notes: body.call_notes,
      updated_at: now,
    };

    // Add customer satisfaction data if provided
    if (body.customer_satisfaction_score) {
      updateData.customer_satisfaction_score = body.customer_satisfaction_score;
      updateData.customer_rating = body.customer_satisfaction_score;
    }

    if (body.customer_feedback) {
      updateData.customer_feedback = body.customer_feedback;
      updateData.customer_feedback_at = now;
    }

    // Add follow-up data
    if (body.follow_up_required !== undefined) {
      updateData.follow_up_required = body.follow_up_required;
    }

    if (body.next_follow_up_at) {
      updateData.next_follow_up_at = body.next_follow_up_at;
    }

    // Update lead
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating lead:', updateError);
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
    }

    // Log CSE activity
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'CSE_FINAL_CALL',
        description: `CSE final call completed. Satisfaction: ${body.customer_satisfaction_score || 'N/A'}/5`,
        metadata: {
          cse_id: userProfile.id,
          call_duration: body.call_duration,
          satisfaction_score: body.customer_satisfaction_score,
          issues_resolved: body.issues_resolved,
          pending_issues: body.pending_issues,
          follow_up_required: body.follow_up_required,
          called_at: now,
        },
      });

    // Create status history entry
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: lead.status, // Status doesn't change, just logging call
        changed_by_id: userProfile.id,
        changed_at: now,
        reason: 'CSE final call completed',
        notes: body.call_notes || 'CSE follow-up call completed',
      });

    return NextResponse.json({
      success: true,
      message: 'Final call logged successfully',
      lead: updatedLead,
      satisfaction_score: body.customer_satisfaction_score,
      ready_to_close: !body.follow_up_required && body.customer_satisfaction_score && body.customer_satisfaction_score >= 3,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in CSE final call API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

