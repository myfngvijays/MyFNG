/**
 * ================================================================
 * LEAD MANAGER - ASSIGN WORKSHOP API
 * ================================================================
 * Assigns a validated lead to a workshop
 * ================================================================
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user details to verify role
    const { data: userData, error: userError } = await supabase
      .from('users_login')
      .select('role_id, roles(role_code)')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify user is Lead Manager
    const roleCode = (userData.roles as any)?.role_code;
    if (roleCode !== 'LEAD_MANAGER') {
      return NextResponse.json(
        { error: 'Access denied. Only Lead Managers can assign workshops.' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { lead_id, workshop_id, assignment_notes, priority } = body;

    if (!lead_id || !workshop_id) {
      return NextResponse.json(
        { error: 'Lead ID and Workshop ID are required' },
        { status: 400 }
      );
    }

    // Get the lead
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Check if lead can be assigned/reassigned
    // Allow: VALIDATED (first assignment) or ASSIGNED_TO_WORKSHOP (reassignment before acceptance)
    const canAssign = lead.status === 'VALIDATED' || lead.status === 'ASSIGNED_TO_WORKSHOP';
    
    if (!canAssign) {
      return NextResponse.json(
        { error: `Cannot assign workshop. Lead status must be VALIDATED or ASSIGNED_TO_WORKSHOP. Current status: ${lead.status}` },
        { status: 400 }
      );
    }
    
    // Check if this is a reassignment
    const isReassignment = lead.workshop_id && lead.status === 'ASSIGNED_TO_WORKSHOP';

    // Verify workshop exists and is active
    const { data: workshop, error: workshopError } = await supabase
      .from('workshops')
      .select('*')
      .eq('id', workshop_id)
      .single();

    if (workshopError || !workshop) {
      return NextResponse.json(
        { error: 'Workshop not found' },
        { status: 404 }
      );
    }

    if (!workshop.is_verified) {
      return NextResponse.json(
        { error: 'Workshop is not verified. Cannot assign leads to unverified workshops.' },
        { status: 400 }
      );
    }

    // Calculate SLA deadline (e.g., 2 hours for workshop to accept)
    const slaAcceptDeadline = new Date();
    slaAcceptDeadline.setHours(slaAcceptDeadline.getHours() + 2);

    // Update lead
    const updateData: any = {
      workshop_id,
      assigned_to_workshop_at: new Date().toISOString(),
      lead_manager_assigned_id: user.id,
      lead_manager_assigned_at: new Date().toISOString(),
      status: 'ASSIGNED_TO_WORKSHOP',
      sla_accept_deadline: slaAcceptDeadline.toISOString(),
      sla_status: 'ON_TIME',
      updated_at: new Date().toISOString(),
    };

    if (priority) {
      updateData.priority = priority;
    }

    if (assignment_notes) {
      updateData.internal_notes = assignment_notes;
    }

    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update(updateData)
      .eq('id', lead_id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to assign workshop', details: updateError.message },
        { status: 500 }
      );
    }

    // Log the activity
    const activityType = isReassignment ? 'WORKSHOP_REASSIGNED' : 'WORKSHOP_ASSIGNED';
    const activityDescription = isReassignment 
      ? `Lead reassigned from previous workshop to: ${workshop.name}`
      : `Lead assigned to workshop: ${workshop.name}`;
    
    await supabase.from('lead_activities').insert({
      lead_id,
      user_id: user.id,
      activity_type: activityType,
      description: activityDescription,
      old_status: lead.status,
      new_status: 'ASSIGNED_TO_WORKSHOP',
      metadata: { 
        workshop_id,
        workshop_name: workshop.name,
        previous_workshop_id: isReassignment ? lead.workshop_id : null,
        assignment_notes,
        priority,
        is_reassignment: isReassignment
      }
    });

    // Log status history
    const statusReason = isReassignment ? 'Workshop Reassignment' : 'Workshop Assignment';
    const statusNotes = isReassignment 
      ? `Reassigned to ${workshop.name}. ${assignment_notes || ''}`
      : `Assigned to ${workshop.name}. ${assignment_notes || ''}`;
      
    await supabase.from('lead_status_history').insert({
      lead_id,
      old_status: lead.status,
      new_status: 'ASSIGNED_TO_WORKSHOP',
      changed_by: user.id,
      reason: statusReason,
      notes: statusNotes
    });

    // Create event for workshop admin notification
    const eventType = isReassignment ? 'WORKSHOP_REASSIGNED' : 'WORKSHOP_ASSIGNED';
    const eventDescription = isReassignment
      ? `Lead ${lead.lead_number} has been reassigned to your workshop`
      : `Lead ${lead.lead_number} has been assigned to your workshop`;
      
    await supabase.from('lead_events').insert({
      lead_id,
      event_type: eventType,
      event_description: eventDescription,
      event_data: {
        workshop_id,
        workshop_name: workshop.name,
        lead_manager_id: user.id,
        sla_deadline: slaAcceptDeadline.toISOString(),
        is_reassignment: isReassignment,
        previous_workshop_id: isReassignment ? lead.workshop_id : null
      },
      created_by: user.id
    });

    return NextResponse.json({
      success: true,
      message: isReassignment 
        ? `Lead successfully reassigned to ${workshop.name}`
        : `Lead successfully assigned to ${workshop.name}`,
      lead: updatedLead,
      workshop: {
        id: workshop.id,
        name: workshop.name,
        city: workshop.city,
        contact_person: workshop.contact_person
      },
      sla_accept_deadline: slaAcceptDeadline.toISOString(),
      is_reassignment: isReassignment
    });

  } catch (error: any) {
    console.error('Assign workshop error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

