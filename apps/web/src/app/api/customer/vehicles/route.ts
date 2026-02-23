import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const { data, error } = await supabaseAdmin
    .from('customer_vehicles')
    .select('*')
    .eq('customer_id', customer.id)
    .order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Failed to fetch vehicles' }, { status: 500 });
  return NextResponse.json({ vehicles: data || [] });
}

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));

  const vehicleNumber = String(body.vehicle_number || '').trim().toUpperCase();
  if (!vehicleNumber) return NextResponse.json({ error: 'vehicle_number required' }, { status: 400 });

  const payload = {
    customer_id: customer.id,
    vehicle_number: vehicleNumber,
    make: body.make || null,
    model: body.model || null,
    year: body.year ? Number(body.year) : null,
    variant: body.variant || null,
    fuel_type: body.fuel_type || null,
    vin: body.vin || null,
    odometer_km: body.odometer_km ? Number(body.odometer_km) : null,
    is_default: Boolean(body.is_default),
  };

  if (payload.is_default) {
    await supabaseAdmin.from('customer_vehicles').update({ is_default: false }).eq('customer_id', customer.id);
  }

  const { data, error } = await supabaseAdmin.from('customer_vehicles').insert(payload).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logCustomerEvent(supabaseAdmin, customer.id, 'vehicle_added', 'vehicle', { vehicleNumber });
  return NextResponse.json({ vehicle: data });
}

