import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { ALL_SHARE_PRICING_CATEGORIES, createPricingShareLink } from '@/lib/telecaller/pricingShareLinks';

export const dynamic = 'force-dynamic';

function digits(value: unknown, max: number) {
  return String(value || '').replace(/\D/g, '').slice(-max);
}

/** Pricing link only after this page's mobile OTP is verified. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const phone = digits(body.phone, 10);
  const pincode = String(body.pincode || '').replace(/\D/g, '').slice(0, 6);
  const carModel = String(body.carModel || body.car_model || '').trim();
  const city = String(body.city || '').trim() || null;
  const customerName = String(body.customerName || body.customer_name || '').trim() || null;

  if (!/^[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ error: 'Verify your mobile number first.' }, { status: 400 });
  }
  if (!carModel) {
    return NextResponse.json({ error: 'Select your car to open prices.' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ error: 'Enter a 6-digit pincode to open prices.' }, { status: 400 });
  }

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: adminError || 'Server configuration error' }, { status: 500 });
  }

  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: verified } = await supabaseAdmin
    .from('otp_requests')
    .select('id')
    .eq('phone', phone)
    .eq('status', 'VERIFIED')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!verified?.id) {
    return NextResponse.json({ error: 'Verify the OTP before opening prices.' }, { status: 403 });
  }

  const created = await createPricingShareLink({
    customerName,
    customerPhone: phone,
    carModel,
    pincode,
    city,
    categories: [...ALL_SHARE_PRICING_CATEGORIES],
    ttlHours: 6,
  });

  if ('error' in created) {
    return NextResponse.json({ error: 'Could not open the price list. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ url: created.url, expires_at: created.row.expires_at });
}
