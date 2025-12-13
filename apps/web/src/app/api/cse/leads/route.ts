/**
 * CSE Leads API
 * GET /api/cse/leads
 * 
 * Fetch leads assigned to CSE for follow-up and closure
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter') || 'all'; // all, follow_up, invoiced, completed
    const priority = searchParams.get('priority'); // HIGH, MEDIUM, LOW
    const search = searchParams.get('search');

    // Build query
    let query = supabase
      .from('service_leads')
      .select(`
        *,
        workshop:workshops!workshop_id(name, phone),
        assigned_mechanic:users_login!assigned_mechanic_id(full_name),
        closed_by:users_login!closed_by_id(full_name)
      `)
      .order('updated_at', { ascending: false });

    // Apply filters based on CSE responsibility stages
    if (filter === 'follow_up') {
      // Leads requiring follow-up (payment pending, delivery pending)
      query = query
        .in('status', ['INVOICE_GENERATED', 'AWAITING_PAYMENT', 'AWAITING_DELIVERY'])
        .eq('follow_up_required', true);
    } else if (filter === 'invoiced') {
      // Recently invoiced leads
      query = query.eq('status', 'INVOICE_GENERATED');
    } else if (filter === 'completed') {
      // Completed but not yet closed
      query = query
        .in('status', ['COMPLETED', 'PAYMENT_COMPLETED', 'DELIVERED_TO_CUSTOMER', 'DELIVERED'])
        .is('closed_at', null);
    } else if (filter === 'closed') {
      // Already closed leads
      query = query.eq('status', 'CLOSED');
    } else {
      // All leads in CSE scope
      query = query.in('status', [
        'INVOICE_GENERATED',
        'AWAITING_PAYMENT', 
        'PAYMENT_COMPLETED',
        'AWAITING_DELIVERY',
        'DELIVERED_TO_CUSTOMER',
        'DELIVERED',
        'COMPLETED',
        'CLOSED'
      ]);
    }

    // Apply priority filter
    if (priority) {
      query = query.eq('priority', priority);
    }

    // Apply search
    if (search) {
      query = query.or(
        `lead_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`
      );
    }

    // Limit results
    query = query.limit(100);

    const { data: leads, error: leadsError } = await query;

    if (leadsError) {
      console.error('Error fetching CSE leads:', leadsError);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    // Calculate stats
    const stats = {
      total: leads?.length || 0,
      pendingFollowUps: leads?.filter(l => l.follow_up_required && l.status !== 'CLOSED').length || 0,
      awaitingPayment: leads?.filter(l => l.status === 'AWAITING_PAYMENT').length || 0,
      readyToClose: leads?.filter(l => ['COMPLETED', 'DELIVERED_TO_CUSTOMER', 'DELIVERED'].includes(l.status) && !l.closed_at).length || 0,
      closedToday: leads?.filter(l => {
        if (!l.closed_at) return false;
        const closedDate = new Date(l.closed_at);
        const today = new Date();
        return closedDate.toDateString() === today.toDateString();
      }).length || 0,
    };

    return NextResponse.json({
      success: true,
      leads: leads || [],
      stats,
      filter,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in CSE leads API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

