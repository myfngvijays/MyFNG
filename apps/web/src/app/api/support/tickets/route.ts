/**
 * Support Tickets API
 * Phase 2 - Step 6 & 7: Support Ticket Management
 * Purpose: Manage support tickets created from delivery damage and CSE follow-ups
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const assigned_to = searchParams.get('assigned_to');

    let query = supabase
      .from('support_tickets')
      .select(`
        *,
        lead:service_leads(id, lead_number, customer_name, customer_phone),
        invoice:invoices(id, invoice_number),
        assigned_user:users_login!assigned_to(id, name, role),
        created_user:users_login!created_by(id, name, role)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    if (assigned_to) {
      query = query.eq('assigned_to', assigned_to);
    } else if (userProfile.role === 'workshop_admin' || userProfile.role === 'supervisor') {
      // Show tickets assigned to user or unassigned
      query = query.or(`assigned_to.eq.${userProfile.id},assigned_to.is.null`);
    }

    const { data: tickets, error: ticketsError } = await query;

    if (ticketsError) {
      console.error('Error fetching tickets:', ticketsError);
      return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
    }

    // Group by status
    const grouped = tickets?.reduce((acc: any, ticket: any) => {
      const status = ticket.status;
      if (!acc[status]) acc[status] = [];
      acc[status].push(ticket);
      return acc;
    }, {}) || {};

    return NextResponse.json({
      success: true,
      tickets: tickets || [],
      grouped: grouped,
      summary: {
        total: tickets?.length || 0,
        by_status: Object.keys(grouped).reduce((acc: any, key) => {
          acc[key] = grouped[key].length;
          return acc;
        }, {}),
      },
    }, { status: 200 });

  } catch (error) {
    console.error('Error in support tickets API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

