/**
 * Support Ticket Detail API
 * Phase 2: Support Ticket Management
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
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

    const ticketId = params.id;

    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select(`
        *,
        lead:service_leads(
          id,
          lead_number,
          customer_name,
          customer_phone,
          customer_email,
          vehicle_number
        ),
        invoice:invoices(
          id,
          invoice_number,
          final_amount,
          payment_status
        ),
        assigned_user:users_login!assigned_to(id, name, role, email),
        created_user:users_login!created_by(id, name, role),
        resolved_user:users_login!resolved_by(id, name, role)
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ticket: ticket,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get ticket API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Update Ticket (Assign, Resolve, Escalate)
 */
export async function PATCH(
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
      .select('id, role, name')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const ticketId = params.id;
    const body = await request.json();
    const { action, assigned_to, status, resolution_notes, escalated_to, escalation_reason } = body;

    // Get ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updateData: any = {
      updated_at: now,
    };

    if (action === 'ASSIGN' && assigned_to) {
      updateData.assigned_to = assigned_to;
      updateData.assigned_at = now;
      updateData.status = 'IN_PROGRESS';
    } else if (action === 'RESOLVE') {
      updateData.status = 'RESOLVED';
      updateData.resolved_by = userProfile.id;
      updateData.resolved_at = now;
      updateData.resolution_notes = resolution_notes;
    } else if (action === 'CLOSE') {
      updateData.status = 'CLOSED';
    } else if (action === 'ESCALATE' && escalated_to) {
      updateData.escalated = true;
      updateData.escalated_to = escalated_to;
      updateData.escalated_at = now;
      updateData.escalation_reason = escalation_reason;
      updateData.status = 'ESCALATED';
    } else if (status) {
      updateData.status = status;
    }

    const { data: updatedTicket, error: updateError } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating ticket:', updateError);
      return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Ticket ${action || 'updated'} successfully`,
      ticket: updatedTicket,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in update ticket API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

