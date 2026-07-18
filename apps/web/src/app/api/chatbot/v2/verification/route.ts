import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { markPhoneVerifiedInSession, normalizeBookingPhone } from '@/lib/chatbot_v2/bookingOtp';
import { getSession, saveSession } from '@/lib/chatbot_v2/session';
import {
  buildSessionContextPatch,
  setVehicleNumberInSession,
  applyTrustedCustomerToSession,
} from '@/lib/chatbot_v2/verificationSession';
import { getCustomerFromSession } from '@/lib/customer-session';

export const dynamic = 'force-dynamic';

type VerificationAction = 'set_vehicle' | 'sync_phone' | 'sync_trusted_customer';

function mapCustomerVehicle(raw: Record<string, unknown>) {
  return {
    id: String(raw?.id || ''),
    make: String(raw?.make || '').trim(),
    model: String(raw?.model_name || raw?.model || '').trim(),
    vehicle_number: String(raw?.vehicle_number || raw?.registration_number || '').trim() || undefined,
    variant: raw?.variant ? String(raw.variant) : undefined,
    is_default: Boolean(raw?.is_default),
  };
}

function mapCustomerAddress(raw: Record<string, unknown>) {
  const id = String(raw?.id || '').trim();
  const line1 = String(raw?.line1 || raw?.address_line1 || '').trim();
  if (!id || !line1) return null;
  return {
    id,
    label: String(raw?.label || raw?.address_type || 'Home').trim(),
    line1,
    line2: String(raw?.line2 || raw?.address_line2 || '').trim() || undefined,
    city: String(raw?.city || '').trim() || undefined,
    pincode: String(raw?.pincode || '').trim() || undefined,
  };
}

async function loadCustomerPrefillByPhone(
  supabaseAdmin: NonNullable<ReturnType<typeof getSupabaseAdmin>['supabaseAdmin']>,
  phone: string,
) {
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id, full_name, phone')
    .eq('phone', phone)
    .maybeSingle();

  if (!customer?.id) return null;

  const [{ data: vehicles }, { data: addresses }] = await Promise.all([
    supabaseAdmin
      .from('customer_vehicles')
      .select('id, make, model_name, model, vehicle_number, registration_number, variant, is_default')
      .eq('customer_id', customer.id)
      .order('is_default', { ascending: false }),
    supabaseAdmin
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', customer.id)
      .order('is_default', { ascending: false }),
  ]);

  return {
    customer,
    vehicles: (vehicles || []).map((row) => mapCustomerVehicle(row as Record<string, unknown>)),
    addresses: (addresses || [])
      .map((row) => mapCustomerAddress(row as Record<string, unknown>))
      .filter(Boolean),
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    action?: VerificationAction;
    session_id?: string;
    vehicle_number?: string;
    phone?: string;
  } | null;

  const sessionId = String(body?.session_id || '').trim();
  const action = body?.action;

  if (!sessionId || !action) {
    return NextResponse.json({ success: false, error: 'session_id and action are required' }, { status: 400 });
  }

  const sessionData = await getSession(sessionId);

  if (action === 'set_vehicle') {
    const result = setVehicleNumberInSession(sessionData, body?.vehicle_number);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.message }, { status: 400 });
    }

    await saveSession(sessionId, sessionData);
    return NextResponse.json({
      success: true,
      contextPatch: buildSessionContextPatch(sessionData, sessionId),
    });
  }

  if (action === 'sync_trusted_customer') {
    const { customer } = await getCustomerFromSession();
    if (!customer?.phone) {
      return NextResponse.json(
        { success: false, error: 'Logged-in customer required' },
        { status: 401 },
      );
    }

    applyTrustedCustomerToSession(sessionData, {
      phone: customer.phone,
      full_name: customer.full_name,
      id: customer.id,
    });

    await saveSession(sessionId, sessionData);
    return NextResponse.json({
      success: true,
      contextPatch: buildSessionContextPatch(sessionData, sessionId, {
        customerName: customer.full_name || undefined,
        isLoggedInCustomer: true,
        skipNamePrompt: Boolean(customer.full_name),
        skipMobilePrompt: true,
      }),
    });
  }

  if (action === 'sync_phone') {
    const phone = normalizeBookingPhone(body?.phone);
    if (phone.length !== 10) {
      return NextResponse.json({ success: false, error: 'Valid 10-digit phone is required' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
    }

    const windowStart = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from('otp_requests')
      .select('id, status, metadata, created_at')
      .eq('phone', phone)
      .eq('channel', 'WHATSAPP')
      .eq('status', 'VERIFIED')
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to verify OTP status' }, { status: 500 });
    }

    if (!rows?.length) {
      return NextResponse.json(
        { success: false, error: 'No recent verified OTP found for this number. Please verify OTP first.' },
        { status: 400 },
      );
    }

    markPhoneVerifiedInSession(sessionData, phone);
    sessionData.bookingState = {
      ...(sessionData.bookingState || {}),
      phoneNumber: phone,
    };

    const prefill = await loadCustomerPrefillByPhone(supabaseAdmin, phone);
    if (prefill?.customer) {
      applyTrustedCustomerToSession(sessionData, {
        phone: prefill.customer.phone,
        full_name: prefill.customer.full_name,
        id: prefill.customer.id,
      });
      const defaultVehicle = prefill.vehicles.find((v) => v.vehicle_number) || prefill.vehicles[0];
      if (defaultVehicle?.vehicle_number) {
        const vehicleResult = setVehicleNumberInSession(sessionData, defaultVehicle.vehicle_number);
        if (!vehicleResult.ok) {
          // ignore invalid stored numbers
        }
      }
    }

    await saveSession(sessionId, sessionData);
    return NextResponse.json({
      success: true,
      contextPatch: {
        ...buildSessionContextPatch(sessionData, sessionId, {
          customerName: prefill?.customer?.full_name || undefined,
          skipNamePrompt: Boolean(prefill?.customer?.full_name),
          skipMobilePrompt: true,
          isLoggedInCustomer: Boolean(prefill?.customer),
        }),
        customerVehicles: prefill?.vehicles || [],
        customerAddresses: prefill?.addresses || [],
      },
    });
  }

  return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
}
