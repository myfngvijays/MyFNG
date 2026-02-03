/**
 * CSE Sub Admin Ticket Merge API
 * POST /api/subadmin/cse/tickets/[id]/merge
 * Merge duplicate tickets
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, department, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const department = userProfile.department;

    if (roleCode !== 'SUB_ADMIN' || department !== 'CSE') {
      return NextResponse.json({ error: 'Forbidden: CSE Sub Admin role required' }, { status: 403 });
    }

    const primaryTicketId = params.id;
    const body = await request.json();
    const { merge_with_ticket_ids, notes } = body;

    if (!merge_with_ticket_ids || !Array.isArray(merge_with_ticket_ids) || merge_with_ticket_ids.length === 0) {
      return NextResponse.json(
        { error: 'merge_with_ticket_ids array is required' },
        { status: 400 }
      );
    }

    // Get primary ticket
    const { data: primaryTicket, error: primaryError } = await supabase
      .from('customer_complaints')
      .select('*')
      .eq('id', primaryTicketId)
      .single();

    if (primaryError || !primaryTicket) {
      return NextResponse.json({ error: 'Primary ticket not found' }, { status: 404 });
    }

    // Get tickets to merge
    const { data: ticketsToMerge, error: mergeError } = await supabase
      .from('customer_complaints')
      .select('*')
      .in('id', merge_with_ticket_ids);

    if (mergeError || !ticketsToMerge || ticketsToMerge.length === 0) {
      return NextResponse.json({ error: 'Tickets to merge not found' }, { status: 404 });
    }

    // Verify all tickets belong to same customer/lead
    const allSameCustomer = ticketsToMerge.every(t => 
      t.customer_id === primaryTicket.customer_id || t.lead_id === primaryTicket.lead_id
    );

    if (!allSameCustomer) {
      return NextResponse.json(
        { error: 'Cannot merge tickets for different customers/leads' },
        { status: 400 }
      );
    }

    // Merge: Combine descriptions and attachments
    const mergedDescription = [
      primaryTicket.description,
      ...ticketsToMerge.map(t => `[Merged from ${t.complaint_number}]: ${t.description}`),
    ].join('\n\n');

    const mergedAttachments = [
      ...(primaryTicket.attachments || []),
      ...ticketsToMerge.flatMap(t => t.attachments || []),
    ];

    // Update primary ticket
    const { data: updatedTicket, error: updateError } = await supabase
      .from('customer_complaints')
      .update({
        description: mergedDescription,
        attachments: mergedAttachments,
        internal_notes: notes || `Merged ${ticketsToMerge.length} duplicate tickets`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', primaryTicketId)
      .select()
      .single();

    if (updateError || !updatedTicket) {
      console.error('Error updating primary ticket:', updateError);
      return NextResponse.json(
        { error: 'Failed to merge tickets', details: updateError?.message },
        { status: 500 }
      );
    }

    // Close merged tickets
    const { error: closeError } = await supabase
      .from('customer_complaints')
      .update({
        status: 'CLOSED',
        closed_by: user.id,
        closed_at: new Date().toISOString(),
        closure_notes: `Merged into ticket ${primaryTicket.complaint_number}`,
        updated_at: new Date().toISOString(),
      })
      .in('id', merge_with_ticket_ids);

    if (closeError) {
      console.error('Error closing merged tickets:', closeError);
      // Don't fail - primary ticket is already updated
    }

    // Log action
    await supabase.from('subadmin_actions').insert({
      subadmin_id: user.id,
      department: 'CSE',
      action_type: 'MERGE_TICKETS',
      action_description: `Merged ${ticketsToMerge.length} tickets into ${primaryTicket.complaint_number}`,
      related_entity_type: 'TICKET',
      related_entity_id: primaryTicketId,
      metadata: {
        primary_ticket: primaryTicketId,
        merged_tickets: merge_with_ticket_ids,
        notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      primary_ticket: updatedTicket,
      merged_tickets: ticketsToMerge.map(t => t.id),
      message: `Successfully merged ${ticketsToMerge.length} tickets`,
    });

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/cse/tickets/[id]/merge:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

