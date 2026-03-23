import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const body = await request.json().catch(() => ({}));
  const line1 = String(body.line1 || '').trim();
  if (!line1) {
    return NextResponse.json({ error: 'line1 required' }, { status: 400 });
  }

  const label = String(body.label || 'Home').trim() || 'Home';
  const payload = {
    customer_id: customer.id,
    label,
    line1,
    line2: String(body.line2 || '').trim() || null,
    city: String(body.city || '').trim() || null,
    state: String(body.state || '').trim() || null,
    pincode: String(body.pincode || '').trim() || null,
    latitude: typeof body.latitude === 'number' ? body.latitude : null,
    longitude: typeof body.longitude === 'number' ? body.longitude : null,
    is_default: Boolean(body.is_default),
  };

  if (payload.is_default) {
    await supabaseAdmin
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', customer.id);
  }

  const { data, error } = await supabaseAdmin
    .from('customer_addresses')
    .insert(payload)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logCustomerEvent(supabaseAdmin, customer.id, 'address_added', 'address', {
    addressId: data.id,
    label,
  });

  return NextResponse.json({ address: data });
}

export async function PATCH(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const updates: Record<string, any> = {};
  if (body.label !== undefined) updates.label = String(body.label || 'Home').trim();
  if (body.line1 !== undefined) updates.line1 = String(body.line1 || '').trim();
  if (body.line2 !== undefined) updates.line2 = String(body.line2 || '').trim() || null;
  if (body.city !== undefined) updates.city = String(body.city || '').trim() || null;
  if (body.state !== undefined) updates.state = String(body.state || '').trim() || null;
  if (body.pincode !== undefined) updates.pincode = String(body.pincode || '').trim() || null;
  if (typeof body.latitude === 'number') updates.latitude = body.latitude;
  if (typeof body.longitude === 'number') updates.longitude = body.longitude;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('customer_addresses')
    .update(updates)
    .eq('id', id)
    .eq('customer_id', customer.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logCustomerEvent(supabaseAdmin, customer.id, 'address_updated', 'address', {
    addressId: id,
  });

  return NextResponse.json({ address: data });
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('customer_addresses')
    .delete()
    .eq('id', id)
    .eq('customer_id', customer.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logCustomerEvent(supabaseAdmin, customer.id, 'address_deleted', 'address', { addressId: id });
  return NextResponse.json({ success: true });
}
