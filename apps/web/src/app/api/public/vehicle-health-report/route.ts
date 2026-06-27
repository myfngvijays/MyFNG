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
    const regNumber = String(body.reg_number || body.regNumber || '').trim().toUpperCase();
    if (!regNumber || regNumber === 'UNKNOWN') {
      return NextResponse.json({ error: 'reg_number required' }, { status: 400 });
    }
    if (!body.report_json || !body.report_text) {
      return NextResponse.json({ error: 'report_json and report_text required' }, { status: 400 });
    }

    const headerPlatform = request.headers.get('x-app-platform') || request.headers.get('X-App-Platform');
    const jsonPlatform = body.report_json?.client?.platform || body.report_json?.client?.os;
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
      /* guest report */
    }

    if (!customerId && customerPhone) {
      const found = await findCustomerByPhone(supabaseAdmin, customerPhone);
      if (found) {
        customerId = found.id;
        customerName = customerName || found.full_name || null;
        customerPhone = normalizeCustomerPhone(found.phone) || customerPhone;
        const { data: extra } = await supabaseAdmin
          .from('customers')
          .select('app_platform')
          .eq('id', found.id)
          .maybeSingle();
        if (platform === 'UNKNOWN' && extra?.app_platform) {
          platform = normalizeHealthPlatform(extra.app_platform);
        }
      }
    }

    if (!customerId) {
      const fromReg = await findCustomerByRegNumber(supabaseAdmin, regNumber);
      if (fromReg) {
        customerId = fromReg.id;
        customerName = customerName || fromReg.full_name || null;
        customerPhone = customerPhone || normalizeCustomerPhone(fromReg.phone);
        if (platform === 'UNKNOWN' && fromReg.app_platform) {
          platform = normalizeHealthPlatform(fromReg.app_platform);
        }
      }
    }

    if (platform !== 'UNKNOWN' && customerId) {
      await supabaseAdmin
        .from('customers')
        .update({ app_platform: platform, updated_at: new Date().toISOString() })
        .eq('id', customerId);
    }

    const row = {
      reg_number: regNumber,
      make: body.make || null,
      model: body.model || null,
      fuel: body.fuel || null,
      registration_year: body.registration_year ?? null,
      odometer: body.odometer ?? null,
      composite_score: Number(body.composite_score ?? body.report_json?.composite ?? 0),
      band_label: body.band_label || body.report_json?.band?.label || null,
      accuracy: body.accuracy || body.report_json?.accuracy || null,
      report_json: body.report_json,
      report_text: String(body.report_text),
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_id: customerId,
      platform: platform === 'UNKNOWN' ? null : platform,
    };

    let insertResult = await supabaseAdmin
      .from('vehicle_health_reports')
      .insert(row)
      .select('id, created_at')
      .single();

    if (insertResult.error && row.customer_id) {
      row.customer_id = null;
      insertResult = await supabaseAdmin
        .from('vehicle_health_reports')
        .insert(row)
        .select('id, created_at')
        .single();
    }

    if (insertResult.error) {
      console.error('[public/vehicle-health-report][POST]', insertResult.error);
      return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: insertResult.data.id, created_at: insertResult.data.created_at });
  } catch (error: any) {
    console.error('[public/vehicle-health-report][POST]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
