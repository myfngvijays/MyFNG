/**
 * GET /api/customer/leads
 * Returns service leads for the current customer (session).
 */

import { NextResponse } from 'next/server';
import { getCustomerFromSession } from '@/lib/customer-session';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { customer } = await getCustomerFromSession();
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { data: leads, error } = await supabaseAdmin
    .from('service_leads')
    .select('id, lead_number, status, vehicle_number, vehicle_make, vehicle_model, service_type, created_at, customer_phone')
    .eq('customer_phone', customer.phone)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }

  return NextResponse.json({ leads: leads || [] });
}
