import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.make === 'string') update.make = body.make;
  if (typeof body.model === 'string') update.model = body.model;
  if (typeof body.year !== 'undefined') update.year = body.year ? Number(body.year) : null;
  if (typeof body.variant === 'string') update.variant = body.variant;
  if (typeof body.fuel_type === 'string') update.fuel_type = body.fuel_type;
  if (typeof body.vin === 'string') update.vin = body.vin;
  if (typeof body.odometer_km !== 'undefined') update.odometer_km = body.odometer_km ? Number(body.odometer_km) : null;
  if (typeof body.insurance_expiry !== 'undefined') update.insurance_expiry = body.insurance_expiry || null;
  if (typeof body.is_default !== 'undefined') {
    update.is_default = Boolean(body.is_default);
    if (Boolean(body.is_default)) {
      await supabaseAdmin.from('customer_vehicles').update({ is_default: false }).eq('customer_id', customer.id);
    }
  }

  const { data, error } = await supabaseAdmin
    .from('customer_vehicles')
    .update(update)
    .eq('id', id)
    .eq('customer_id', customer.id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'Vehicle update failed' }, { status: 400 });
  await logCustomerEvent(supabaseAdmin, customer.id, 'vehicle_updated', 'vehicle', { vehicleId: id });
  return NextResponse.json({ vehicle: data });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const { id } = await params;

  await supabaseAdmin.from('customer_vehicles').delete().eq('id', id).eq('customer_id', customer.id);
  await logCustomerEvent(supabaseAdmin, customer.id, 'vehicle_deleted', 'vehicle', { vehicleId: id });
  return NextResponse.json({ success: true });
}

