/**
 * CSE Tickets API
 * GET /api/cse/tickets - List tickets
 * POST /api/cse/tickets - Create ticket
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify CSE role
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    if (roleCode !== 'CUSTOMER_SERVICE_EXECUTIVE' && roleCode !== 'CSE') {
      return NextResponse.json({ error: 'Forbidden: CSE role required' }, { status: 403 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const severity = searchParams.get('severity');
    const leadId = searchParams.get('lead_id');

    // Build query
    let query = supabase
      .from('customer_support_tickets')
      .select(`
        *,
        lead:service_leads!lead_id(
          id,
          lead_number,
          customer_name,
          customer_phone,
          vehicle_number,
          status,
          workshop:workshops!workshop_id(id, name, phone)
        ),
        assigned_to_user:users_login!assigned_to(full_name, phone),
        created_by_user:users_login!created_by(full_name),
        resolved_by_user:users_login!resolved_by(full_name)
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (category) {
      query = query.eq('issue_category', category);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (leadId) {
      query = query.eq('lead_id', leadId);
    }

    // CSE can only see tickets assigned to them or created by them
    query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);

    const { data: tickets, error: ticketsError } = await query;

    if (ticketsError) {
      console.error('Error fetching tickets:', ticketsError);
      return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tickets: tickets || [],
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in CSE tickets API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify CSE role
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    if (roleCode !== 'CUSTOMER_SERVICE_EXECUTIVE' && roleCode !== 'CSE') {
      return NextResponse.json({ error: 'Forbidden: CSE role required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      lead_id,
      issue_category,
      severity = 'MEDIUM',
      title,
      description,
      customer_expected_resolution,
      sla_time,
    } = body;

    // Validate required fields
    if (!lead_id || !issue_category || !title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: lead_id, issue_category, title, description' },
        { status: 400 }
      );
    }

    // Create ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('customer_support_tickets')
      .insert({
        lead_id,
        issue_category,
        severity,
        title,
        description,
        customer_expected_resolution,
        sla_time: sla_time || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Default 24 hours
        status: 'OPEN',
        assigned_to: user.id, // Assign to creator by default
        assigned_at: new Date().toISOString(),
        assigned_by: user.id,
        created_by: user.id,
      })
      .select()
      .single();

    if (ticketError) {
      console.error('Error creating ticket:', ticketError);
      return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
    }

    // Log activity
    await supabase.from('lead_activities').insert({
      lead_id,
      user_id: user.id,
      activity_type: 'TICKET_CREATED',
      description: `Support ticket created: ${title}`,
      metadata: { ticket_id: ticket.id, ticket_number: ticket.ticket_number },
    });

    return NextResponse.json({
      success: true,
      ticket,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error in CSE create ticket API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

