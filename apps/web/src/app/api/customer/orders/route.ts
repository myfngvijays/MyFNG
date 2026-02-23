import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const vehicle = searchParams.get('vehicle');
  const q = searchParams.get('q');

  let query = supabaseAdmin
    .from('service_leads')
    .select('id, lead_number, status, service_type, vehicle_number, vehicle_make, vehicle_model, actual_amount, created_at, completed_at, invoice_id')
    .eq('customer_phone', customer.phone)
    .order('created_at', { ascending: false })
    .limit(200);

  if (status) query = query.eq('status', status);
  if (vehicle) query = query.eq('vehicle_number', vehicle);
  if (q) query = query.ilike('lead_number', `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to fetch order history' }, { status: 500 });
  return NextResponse.json({ orders: data || [] });
}

