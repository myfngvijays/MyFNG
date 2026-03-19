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
