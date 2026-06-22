import { NextRequest, NextResponse } from 'next/server';
import { ensureWalletAccount } from '@/lib/customer-api';
import { generateSessionToken, getSessionMaxAgeSeconds } from '@/lib/customer-session';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveAppPlatformFromRequest } from '@/lib/app-platform';

export const dynamic = 'force-dynamic';

function normalizePhone(raw: unknown) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits.length >= 10 ? digits.slice(-10) : '';
}

function vehicleSnapshot(v: { vehicle_number?: string; make?: string; model?: string; id?: string }) {
  return {
    vehicle_number: String(v.vehicle_number || '').trim().toUpperCase(),
    make: String(v.make || '').trim(),
    model: String(v.model || '').trim(),
    vehicle_id: v.id || null,
  };
}

async function upsertVehicle(
  supabaseAdmin: any,
  customerId: string,
  input: { vehicle_number?: string; make?: string; model?: string },
  isDefault = false,
) {
  const vehicle_number = String(input.vehicle_number || '').trim().toUpperCase();
  const make = String(input.make || '').trim();
  const model = String(input.model || '').trim();
  if (!vehicle_number || !make || !model) return null;

  const { data: existing } = await supabaseAdmin
    .from('customer_vehicles')
    .select('id, vehicle_number, make, model')
    .eq('customer_id', customerId)
    .eq('vehicle_number', vehicle_number)
    .maybeSingle();

  if (existing?.id) {
    const { data: updated } = await supabaseAdmin
      .from('customer_vehicles')
      .update({ make, model, updated_at: new Date().toISOString(), ...(isDefault ? { is_default: true } : {}) })
      .eq('id', existing.id)
      .select('id, vehicle_number, make, model')
      .single();
    return updated || existing;
  }

  const { data: inserted } = await supabaseAdmin
    .from('customer_vehicles')
    .insert({
      customer_id: customerId,
      vehicle_number,
      make,
      model,
      is_default: isDefault,
    })
    .select('id, vehicle_number, make, model')
    .single();

  return inserted || null;
}

export async function POST(request: NextRequest) {
  try {
    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured', details: adminErr }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const phone = normalizePhone(body.phone);
    const name = String(body.full_name || body.name || '').trim();
    const appPlatform = resolveAppPlatformFromRequest(request, body?.platform);
    const primary = body.primary_vehicle || body.vehicle || {};
    const second = body.second_vehicle || null;

    if (!phone || phone.length !== 10) {
      return NextResponse.json({ error: 'Valid 10-digit mobile number is required' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const primaryNumber = String(primary.vehicle_number || '').trim().toUpperCase();
    const primaryMake = String(primary.make || '').trim();
    const primaryModel = String(primary.model || '').trim();
    if (!primaryNumber || !primaryMake || !primaryModel) {
      return NextResponse.json({ error: 'Primary car number, make and model are required' }, { status: 400 });
    }

    const { data: existingCustomer } = await supabaseAdmin
      .from('customers')
      .select('id, full_name, phone')
      .ilike('phone', `%${phone}`)
      .maybeSingle();

    let customerId = existingCustomer?.id as string | undefined;
    if (customerId) {
      const updatePayload: Record<string, unknown> = {
        full_name: name || existingCustomer?.full_name,
        phone,
        updated_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      };
      if (appPlatform) updatePayload.app_platform = appPlatform;
      await supabaseAdmin.from('customers').update(updatePayload).eq('id', customerId);
    } else {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('customers')
        .insert({
          phone,
          full_name: name,
          phone_verified: false,
          is_active: true,
          app_platform: appPlatform,
          last_login_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (insertErr || !inserted) {
        return NextResponse.json({ error: 'Failed to create customer profile', details: insertErr?.message }, { status: 500 });
      }
      customerId = inserted.id;
    }

    try {
      await ensureWalletAccount(supabaseAdmin, customerId);
    } catch (walletErr) {
      console.error('[membership/prepare-buyer] wallet create failed:', walletErr);
    }

    const primaryVehicle = await upsertVehicle(
      supabaseAdmin,
      customerId,
      { vehicle_number: primaryNumber, make: primaryMake, model: primaryModel },
      true,
    );

    let secondVehicle = null;
    if (second && body.add_second_car) {
      const secondNumber = String(second.vehicle_number || '').trim().toUpperCase();
      const secondMake = String(second.make || '').trim();
      const secondModel = String(second.model || '').trim();
      if (!secondNumber || !secondMake || !secondModel) {
        return NextResponse.json({ error: 'Second car number, make and model are required when add-on is selected' }, { status: 400 });
      }
      secondVehicle = await upsertVehicle(
        supabaseAdmin,
        customerId,
        { vehicle_number: secondNumber, make: secondMake, model: secondModel },
        false,
      );
    }

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + getSessionMaxAgeSeconds() * 1000);
    const userAgent = request.headers.get('user-agent') || null;

    const { error: sessionErr } = await supabaseAdmin.from('customer_sessions').insert({
      customer_id: customerId,
      token,
      expires_at: expiresAt.toISOString(),
      user_agent: userAgent,
      app_platform: appPlatform,
    });
    if (sessionErr) {
      return NextResponse.json({ error: 'Failed to create session', details: sessionErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session_token: token,
      customer_id: customerId,
      primary_vehicle_id: primaryVehicle?.id || null,
      second_vehicle_id: secondVehicle?.id || null,
      primary_vehicle: primaryVehicle ? vehicleSnapshot(primaryVehicle) : vehicleSnapshot(primary),
      second_vehicle: secondVehicle ? vehicleSnapshot(secondVehicle) : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
