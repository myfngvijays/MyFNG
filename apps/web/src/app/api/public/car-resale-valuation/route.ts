import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getCustomerFromSession } from '@/lib/customer-session';
import { findCustomerByPhone, normalizeCustomerPhone } from '@/lib/customer-service-leads';
import { findCustomerByRegNumber, normalizeHealthPlatform } from '@/lib/vehicle-health-reports';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'server_config' }, { status: 500 });
    }

    const body = await request.json();
    if (!body.valuation_json || !body.valuation_text) {
      return NextResponse.json({ error: 'valuation_json and valuation_text required' }, { status: 400 });
    }

    const estimateLow = Number(body.estimate_low ?? body.valuation_json?.estimate?.low);
    const estimateMid = Number(body.estimate_mid ?? body.valuation_json?.estimate?.mid);
    const estimateHigh = Number(body.estimate_high ?? body.valuation_json?.estimate?.high);
    if (!Number.isFinite(estimateLow) || !Number.isFinite(estimateMid) || !Number.isFinite(estimateHigh)) {
      return NextResponse.json({ error: 'estimate_low, estimate_mid, estimate_high required' }, { status: 400 });
    }

    const headerPlatform = request.headers.get('x-app-platform') || request.headers.get('X-App-Platform');
    const jsonPlatform = body.valuation_json?.client?.platform || body.valuation_json?.client?.os;
    let platform = normalizeHealthPlatform(body.platform || headerPlatform || jsonPlatform);
    let customerName = String(body.customer_name || body.customerName || '').trim() || null;
    let customerPhone = normalizeCustomerPhone(body.customer_phone || body.customerPhone);
    let customerId: string | null = body.customer_id || null;

    try {
      const { customer } = await getCustomerFromSession();
      if (customer) {
        customerId = customer.id;
        customerName = customerName || customer.full_name || null;
        customerPhone = customerPhone || normalizeCustomerPhone(customer.phone);
        const { data: extra } = await supabaseAdmin
          .from('customers')
          .select('app_platform')
          .eq('id', customer.id)
          .maybeSingle();
        if (platform === 'UNKNOWN' && extra?.app_platform) {
          platform = normalizeHealthPlatform(extra.app_platform);
        }
      }
    } catch {
      /* guest valuation */
    }

    if (!customerId && customerPhone) {
      const found = await findCustomerByPhone(supabaseAdmin, customerPhone);
      if (found) {
        customerId = found.id;
        customerName = customerName || found.full_name || null;
        customerPhone = normalizeCustomerPhone(found.phone) || customerPhone;
      }
    }

    const vehicleNumber = String(body.vehicle_number || '').trim().toUpperCase();
    if (!customerId && vehicleNumber) {
      const fromReg = await findCustomerByRegNumber(supabaseAdmin, vehicleNumber);
      if (fromReg) {
        customerId = fromReg.id;
        customerName = customerName || fromReg.full_name || null;
        customerPhone = customerPhone || normalizeCustomerPhone(fromReg.phone);
        if (platform === 'UNKNOWN' && fromReg.app_platform) {
          platform = normalizeHealthPlatform(fromReg.app_platform);
        }
      }
    }

    const row = {
      make: body.make || null,
      model: body.model || null,
      model_id: body.model_id || null,
      vehicle_class: body.vehicle_class || null,
      vehicle_number: body.vehicle_number || null,
      registration_year: body.registration_year ?? null,
      fuel: body.fuel || null,
      transmission: body.transmission || null,
      odometer: body.odometer ?? null,
      owners: body.owners ?? null,
      condition: body.condition || null,
      had_accident: Boolean(body.had_accident),
      insurance_valid: body.insurance_valid == null ? null : Boolean(body.insurance_valid),
      service_records: body.service_records || null,
      city_name: body.city_name || null,
      city_tier: body.city_tier || null,
      estimate_low: estimateLow,
      estimate_mid: estimateMid,
      estimate_high: estimateHigh,
      valuation_json: body.valuation_json,
      valuation_text: String(body.valuation_text),
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_id: customerId,
      platform: platform === 'UNKNOWN' ? null : platform,
    };

    let insertResult = await supabaseAdmin
      .from('car_resale_valuations')
      .insert(row)
      .select('id, created_at')
      .single();

    if (insertResult.error && row.model_id) {
      row.model_id = null;
      insertResult = await supabaseAdmin
        .from('car_resale_valuations')
        .insert(row)
        .select('id, created_at')
        .single();
    }

    if (insertResult.error && row.customer_id) {
      row.customer_id = null;
      insertResult = await supabaseAdmin
        .from('car_resale_valuations')
        .insert(row)
        .select('id, created_at')
        .single();
    }

    if (insertResult.error) {
      console.error('[public/car-resale-valuation][POST]', insertResult.error);
      return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: insertResult.data.id, created_at: insertResult.data.created_at });
  } catch (error: any) {
    console.error('[public/car-resale-valuation][POST]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
