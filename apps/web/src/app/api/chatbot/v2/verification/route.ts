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

    await saveSession(sessionId, sessionData);
    return NextResponse.json({
      success: true,
      contextPatch: buildSessionContextPatch(sessionData, sessionId),
    });
  }

  return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
}
