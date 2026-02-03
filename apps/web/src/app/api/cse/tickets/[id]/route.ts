/**
 * CSE Ticket Detail API
 * GET /api/cse/tickets/[id]
 * 
 * Get ticket details
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    const ticketId = params.id;
    
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

    // Fetch ticket
    const { data: ticket, error: ticketError } = await supabase
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
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Check if CSE has access
    if (ticket.assigned_to !== user.id && ticket.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not have access to this ticket' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      ticket,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in CSE ticket detail API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

