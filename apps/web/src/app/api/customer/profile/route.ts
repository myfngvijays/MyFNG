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

  // Also pull addresses from past bookings (service_leads) if customer_addresses is empty
  let allAddresses = addresses || [];
  if (allAddresses.length === 0) {
    const phone = customer.phone ? customer.phone.replace(/\D/g, '').slice(-10) : null;
    if (phone) {
      const { data: leads } = await supabaseAdmin
        .from('service_leads')
        .select('id,address,customer_address,city,pickup_address')
        .or(`customer_phone.ilike.%${phone}%,customer_id.eq.${customer.id}`)
        .order('created_at', { ascending: false })
        .limit(10);
      const seen = new Set<string>();
      const fromLeads: any[] = [];
      for (const l of (leads || [])) {
        const addr = l.pickup_address || l.customer_address || l.address || '';
        if (!addr || seen.has(addr.toLowerCase().trim())) continue;
        seen.add(addr.toLowerCase().trim());
        fromLeads.push({
          id: `lead_${l.id}`,
          address_line1: addr,
          city: l.city || null,
          address_type: 'Previous Booking',
          label: 'Previous Booking',
        });
      }
      allAddresses = fromLeads.slice(0, 5);
    }
  }

  return NextResponse.json({
    customer,
    profile: profile || null,
    addresses: allAddresses,
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

