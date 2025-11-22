/**
 * CSE Close Lead API
 * POST /api/cse/leads/[id]/close
 * 
 * Close lead after successful service completion and customer satisfaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface CloseLeadRequest {
  closure_notes?: string;
  final_satisfaction_score?: number; // 1-5
  all_issues_resolved?: boolean;
  customer_recommendation?: boolean; // Would customer recommend?
  service_quality_score?: number; // 1-5
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
    const body: CloseLeadRequest = await request.json();

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Validate lead can be closed
    const validStatuses = ['COMPLETED', 'DELIVERED', 'PAYMENT_COMPLETED'];
    if (!validStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: 'Lead cannot be closed yet',
        current_status: lead.status,
        hint: 'Lead must be completed and payment received',
        required_statuses: validStatuses,
      }, { status: 400 });
    }

    // Check if payment is completed
    if (lead.payment_status !== 'COMPLETED' && lead.payment_status !== 'PAID') {
      return NextResponse.json({ 
        error: 'Payment not completed',
        payment_status: lead.payment_status,
        hint: 'Payment must be completed before closing lead'
      }, { status: 400 });
    }

    // Check if CSE final call was done
    if (!lead.cse_followup_completed) {
      return NextResponse.json({ 
        error: 'Final call not completed',
        hint: 'CSE must complete final call before closing lead'
      }, { status: 400 });
    }

    // Check if customer satisfaction is acceptable
    if (lead.customer_satisfaction_score && lead.customer_satisfaction_score < 3) {
      return NextResponse.json({ 
        error: 'Customer satisfaction too low',
        satisfaction_score: lead.customer_satisfaction_score,
        hint: 'Resolve customer issues before closing (score < 3/5)'
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Close the lead
    const { data: closedLead, error: closeError } = await supabase
      .from('service_leads')
      .update({
        status: 'CLOSED',
        closed_by_id: userProfile.id,
        closed_at: now,
        closure_notes: body.closure_notes,
        final_closure_at: now,
        updated_at: now,
        
        // Update satisfaction scores if provided
        ...(body.final_satisfaction_score && {
          customer_satisfaction_score: body.final_satisfaction_score,
          customer_rating: body.final_satisfaction_score,
        }),
      })
      .eq('id', leadId)
      .select()
      .single();

    if (closeError) {
      console.error('Error closing lead:', closeError);
      return NextResponse.json({ error: 'Failed to close lead' }, { status: 500 });
    }

    // Log closure activity
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'LEAD_CLOSED',
        description: `Lead closed by CSE ${userProfile.full_name}. Final satisfaction: ${body.final_satisfaction_score || lead.customer_satisfaction_score || 'N/A'}/5`,
        metadata: {
          closed_by: userProfile.id,
          closed_by_name: userProfile.full_name,
          closure_notes: body.closure_notes,
          final_satisfaction_score: body.final_satisfaction_score,
          all_issues_resolved: body.all_issues_resolved,
          customer_recommendation: body.customer_recommendation,
          service_quality_score: body.service_quality_score,
          closed_at: now,
        },
      });

    // Create status history entry
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'CLOSED',
        changed_by_id: userProfile.id,
        changed_at: now,
        reason: 'Lead closed by CSE after successful service completion',
        notes: body.closure_notes || 'Service completed successfully. Customer satisfied.',
      });

    // Calculate total lead lifecycle time
    const createdAt = new Date(lead.created_at);
    const closedAt = new Date(now);
    const lifecycleDays = Math.ceil((closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    return NextResponse.json({
      success: true,
      message: 'Lead closed successfully',
      lead: closedLead,
      closure_summary: {
        lead_number: lead.lead_number,
        customer_name: lead.customer_name,
        closed_by: userProfile.full_name,
        closed_at: now,
        lifecycle_days: lifecycleDays,
        final_satisfaction_score: body.final_satisfaction_score || lead.customer_satisfaction_score,
        all_issues_resolved: body.all_issues_resolved,
        final_amount: lead.final_amount,
      },
    }, { status: 200 });

  } catch (error) {
    console.error('Error in CSE close lead API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
