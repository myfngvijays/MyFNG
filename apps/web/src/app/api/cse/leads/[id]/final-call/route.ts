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
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
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

    // Validate lead status (CSE follow-up is meaningful after delivery)
    const validStatuses = ['DELIVERED_TO_CUSTOMER', 'DELIVERED', 'COMPLETED', 'CLOSED', 'ESCALATED', 'COMPLAINT_OPENED', 'CUSTOMER_UNHAPPY'];
    if (!validStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: 'Invalid lead status for final call',
        current_status: lead.status,
        hint: 'Lead must be delivered (or already closed/escalated)'
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update lead with CSE follow-up data
    const updateData: any = {
      cse_assigned_id: userProfile.id,
      cse_followup_completed: true,
      cse_followup_notes: body.call_notes,
      cse_followup_due: false,
      cse_followup_completed_at: now,
      cse_followup_by: userProfile.id,
      cse_notes: body.call_notes,
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

    // Decide closure/escalation
    const satisfaction = body.customer_satisfaction_score;
    const followUpRequired = body.follow_up_required === true;
    const isHappy = typeof satisfaction === 'number' ? satisfaction >= 3 : false;

    // If unhappy or follow-up required -> complaint flow
    if (followUpRequired || (typeof satisfaction === 'number' && satisfaction <= 2)) {
      updateData.status = 'COMPLAINT_OPENED';
    } else if ((lead.status === 'DELIVERED_TO_CUSTOMER' || lead.status === 'DELIVERED') && isHappy) {
      // Happy after delivery -> COMPLETED (workflow-aligned)
      updateData.status = 'COMPLETED';
      updateData.final_closure_at = now;
      updateData.closed_by = userProfile.id;
      // Archive / lock (read-only) after completion
      updateData.read_only = true;
      updateData.archived_at = now;
      updateData.archived_by = userProfile.id;
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

    // If complaint opened: auto-create a CSE support ticket (complaint)
    let createdTicket: any = null;
    if (updatedLead.status === 'COMPLAINT_OPENED') {
      // Avoid duplicate OPEN tickets for same lead
      const { data: existingTicket } = await supabase
        .from('customer_support_tickets')
        .select('id, ticket_number, status')
        .eq('lead_id', leadId)
        .in('status', ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'ESCALATED'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!existingTicket) {
        const severity =
          typeof satisfaction === 'number' && satisfaction <= 2 ? 'HIGH' : 'MEDIUM';

        const descriptionParts = [
          body.customer_feedback ? `Customer Feedback: ${body.customer_feedback}` : null,
          body.pending_issues ? `Pending Issues: ${body.pending_issues}` : null,
          body.call_notes ? `Call Notes: ${body.call_notes}` : null,
        ].filter(Boolean);

        const { data: ticket, error: ticketError } = await supabase
          .from('customer_support_tickets')
          .insert({
            lead_id: leadId,
            invoice_id: lead.invoice_id || null,
            issue_category: 'SERVICE_QUALITY_COMPLAINT',
            severity,
            title: `Post-service complaint for ${lead.lead_number || 'lead'}`,
            description: descriptionParts.join('\n') || 'Customer reported dissatisfaction in post-service call',
            status: 'OPEN',
            assigned_to: userProfile.id,
            assigned_at: now,
            assigned_by: userProfile.id,
            created_by: userProfile.id,
            metadata: {
              satisfaction_score: satisfaction,
              follow_up_required: followUpRequired,
              issues_resolved: body.issues_resolved,
            },
          })
          .select()
          .single();

        if (ticketError) {
          console.error('Error creating customer_support_ticket:', ticketError);
        } else {
          createdTicket = ticket;

          await supabase.from('lead_activities').insert({
            lead_id: leadId,
            user_id: userProfile.id,
            activity_type: 'COMPLAINT_OPENED',
            description: `Complaint ticket opened: ${ticket.ticket_number}`,
            metadata: { ticket_id: ticket.id, ticket_number: ticket.ticket_number },
          });

          await supabase.from('lead_events').insert({
            lead_id: leadId,
            event_type: 'COMPLAINT_OPENED',
            event_description: `Customer complaint opened (ticket ${ticket.ticket_number})`,
            event_data: { ticket_id: ticket.id, ticket_number: ticket.ticket_number, severity },
            created_by: userProfile.id,
            created_at: now,
          });
        }
      } else {
        createdTicket = existingTicket;
      }
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

    // Create status history entry (call + optional close/escalation)
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: updatedLead.status || lead.status,
        changed_by: userProfile.id,
        changed_at: now,
        reason: updatedLead.status === 'COMPLETED'
          ? 'CSE final call completed - lead completed'
          : updatedLead.status === 'COMPLAINT_OPENED'
          ? 'CSE final call completed - customer unhappy / complaint opened'
          : 'CSE final call completed',
        notes: body.call_notes || 'CSE follow-up call completed',
      });

    // Lead events (analytics/audit trail)
    if (updatedLead.status === 'COMPLETED') {
      await supabase.from('lead_events').insert({
        lead_id: leadId,
        event_type: 'LEAD_COMPLETED',
        event_description: 'Lead completed after post-service CSE confirmation',
        event_data: { satisfaction_score: satisfaction },
        created_by: userProfile.id,
        created_at: now,
      });

      // Marketing automation triggers (events only; actual sending handled by external/cron workers)
      const threeMonths = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const sixMonths = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('lead_events').insert([
        {
          lead_id: leadId,
          event_type: 'GOOGLE_REVIEW_REQUEST',
          event_description: 'Trigger Google Review request message',
          event_data: { channel_priority: ['WHATSAPP', 'SMS', 'EMAIL'] },
          created_by: userProfile.id,
          created_at: now,
        },
        {
          lead_id: leadId,
          event_type: 'NEXT_SERVICE_REMINDER_SCHEDULED',
          event_description: 'Next service reminders scheduled (3M & 6M)',
          event_data: { reminders: [{ due_at: threeMonths, type: '3_MONTH' }, { due_at: sixMonths, type: '6_MONTH' }] },
          created_by: userProfile.id,
          created_at: now,
        },
        {
          lead_id: leadId,
          event_type: 'LOYALTY_POINTS_AWARDED',
          event_description: 'Trigger loyalty points award (post-service)',
          event_data: { points_policy: 'DEFAULT' },
          created_by: userProfile.id,
          created_at: now,
        },
      ]);

      // If invoice is fully paid, mark payout readiness (Finance workflow trigger)
      if (lead.invoice_id) {
        const { data: inv } = await supabase
          .from('invoices')
          .select('id, payment_status, final_amount, workshop_id')
          .eq('id', lead.invoice_id)
          .maybeSingle();

        if (inv?.payment_status === 'PAID') {
          await supabase.from('lead_events').insert({
            lead_id: leadId,
            event_type: 'READY_FOR_PAYOUT',
            event_description: 'Lead closed and paid - ready for workshop payout processing',
            event_data: {
              invoice_id: inv.id,
              workshop_id: inv.workshop_id,
              amount: inv.final_amount,
            },
            created_by: userProfile.id,
            created_at: now,
          });
        }
      }
    } else if (updatedLead.status === 'COMPLAINT_OPENED') {
      await supabase.from('lead_events').insert({
        lead_id: leadId,
        event_type: 'CUSTOMER_UNHAPPY',
        event_description: 'Customer unhappy / follow-up required after service',
        event_data: { satisfaction_score: satisfaction, follow_up_required: followUpRequired },
        created_by: userProfile.id,
        created_at: now,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Final call logged successfully',
      lead: updatedLead,
      satisfaction_score: body.customer_satisfaction_score,
      ready_to_close: updatedLead.status === 'COMPLETED',
      ticket: createdTicket,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in CSE final call API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

