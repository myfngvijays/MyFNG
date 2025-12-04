/**
 * CSE Lead Search API
 * GET /api/cse/leads/search?query={phone/lead_id/vehicle/customer}
 * 
 * Search leads by phone, lead ID, vehicle number, or customer name
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

    // Get query parameter
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');

    if (!query || query.length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
    }

    // Build search query
    const { data: leads, error: leadsError } = await supabase
      .from('service_leads')
      .select(`
        *,
        workshop:workshops!workshop_id(id, name, phone, city, address),
        assigned_mechanic:users_login!assigned_mechanic_id(id, full_name, phone),
        assigned_supervisor:users_login!assigned_supervisor_id(id, full_name, phone),
        pickup_boy:users_login!assigned_pickup_boy_id(id, full_name, phone),
        invoices(id, invoice_number, final_amount, status)
      `)
      .or(
        `lead_number.ilike.%${query}%,customer_name.ilike.%${query}%,customer_phone.ilike.%${query}%,vehicle_number.ilike.%${query}%`
      )
      .order('created_at', { ascending: false })
      .limit(20);

    if (leadsError) {
      console.error('Error searching leads:', leadsError);
      return NextResponse.json({ error: 'Failed to search leads' }, { status: 500 });
    }

    // Format response
    const formattedLeads = (leads || []).map((lead: any) => ({
      id: lead.id,
      lead_number: lead.lead_number,
      customer_name: lead.customer_name,
      customer_phone: lead.customer_phone,
      customer_email: lead.customer_email,
      vehicle_number: lead.vehicle_number,
      vehicle_model: lead.vehicle_model,
      vehicle_make: lead.vehicle_make,
      status: lead.status,
      priority: lead.priority,
      workshop: lead.workshop,
      assigned_mechanic: lead.assigned_mechanic,
      assigned_supervisor: lead.assigned_supervisor,
      pickup_boy: lead.pickup_boy,
      invoice: lead.invoices?.[0] || null,
      created_at: lead.created_at,
      updated_at: lead.updated_at,
    }));

    return NextResponse.json({
      success: true,
      leads: formattedLeads,
      count: formattedLeads.length,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in CSE lead search API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

