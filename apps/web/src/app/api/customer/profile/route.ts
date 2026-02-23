import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const { data: profile } = await supabaseAdmin
    .from('customer_profiles')
    .select('*')
    .eq('customer_id', customer.id)
    .maybeSingle();

  const { data: addresses } = await supabaseAdmin
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', customer.id)
    .order('is_default', { ascending: false });

  return NextResponse.json({
    customer,
    profile: profile || null,
    addresses: addresses || [],
  });
}

export async function PUT(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));

  const customerUpdate: Record<string, unknown> = {};
  if (typeof body.full_name === 'string') customerUpdate.full_name = body.full_name.trim();
  if (typeof body.email === 'string') customerUpdate.email = body.email.trim() || null;
  if (typeof body.profile_image === 'string') customerUpdate.profile_image = body.profile_image.trim() || null;

  if (Object.keys(customerUpdate).length > 0) {
    customerUpdate.updated_at = new Date().toISOString();
    await supabaseAdmin.from('customers').update(customerUpdate).eq('id', customer.id);
  }

  const profilePayload: Record<string, unknown> = {
    customer_id: customer.id,
    updated_at: new Date().toISOString(),
  };
  if (typeof body.gender === 'string') profilePayload.gender = body.gender;
  if (typeof body.dob === 'string') profilePayload.dob = body.dob;
  if (typeof body.alt_phone === 'string') profilePayload.alt_phone = body.alt_phone;
  if (body.preferences && typeof body.preferences === 'object') profilePayload.preferences = body.preferences;

  await supabaseAdmin.from('customer_profiles').upsert(profilePayload, { onConflict: 'customer_id' });
  await logCustomerEvent(supabaseAdmin, customer.id, 'profile_updated', 'profile', { hasEmail: Boolean(body.email) });

  return NextResponse.json({ success: true });
}

