/**
 * POST /api/customer/auth/verify-otp
 * Verifies Firebase ID token (after phone OTP), upserts customer, creates session, sets cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/firebase/admin';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  generateSessionToken,
  getSessionCookieName,
  getSessionMaxAgeSeconds,
} from '@/lib/customer-session';
import { creditWelcomeBonus } from '@/lib/wallet-service';
import {
  resolveAppPlatformFromRequest,
} from '@/lib/app-platform';
import {
  customerAccountBlockMessage,
  isCustomerAccountBlocked,
  resolveCustomerAccountStatus,
} from '@/lib/customer-account-admin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = typeof body?.idToken === 'string' ? body.idToken.trim() : null;
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() || null : null;
    const appPlatform = resolveAppPlatformFromRequest(request, body?.platform);

    if (!idToken) {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    const phone = decoded.phone_number;
    if (!phone) {
      return NextResponse.json({ error: 'Phone number not found in token' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
    if (normalizedPhone.length < 10) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    await supabaseAdmin.from('otp_requests').insert({
      phone: normalizedPhone,
      provider: 'FIREBASE',
      status: 'VERIFIED',
      channel: 'SMS',
      ip_address: request.headers.get('x-forwarded-for') || null,
      user_agent: request.headers.get('user-agent') || null,
      metadata: { action: 'verify_otp' },
    });

    let customerId: string;
    let isNewCustomer = false;
    const { data: byPhone } = await supabaseAdmin
      .from('customers')
      .select('id, full_name, is_active, account_status')
      .eq('phone', normalizedPhone)
      .maybeSingle();
    const { data: byUid } = await supabaseAdmin
      .from('customers')
      .select('id, full_name, is_active, account_status')
      .eq('firebase_uid', decoded.uid)
      .maybeSingle();
    const existing = byPhone || byUid;

    if (existing && isCustomerAccountBlocked(existing.is_active, existing.account_status)) {
      const status = resolveCustomerAccountStatus(existing.account_status, existing.is_active);
      return NextResponse.json({ error: customerAccountBlockMessage(status) }, { status: 403 });
    }

    if (existing) {
      customerId = existing.id;
      const updatePayload: Record<string, unknown> = {
        firebase_uid: decoded.uid,
        phone: normalizedPhone,
        phone_verified: true,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (displayName && !existing.full_name) updatePayload.full_name = displayName;
      if (appPlatform) updatePayload.app_platform = appPlatform;
      await supabaseAdmin.from('customers').update(updatePayload).eq('id', customerId);
    } else {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('customers')
        .insert({
          phone: normalizedPhone,
          firebase_uid: decoded.uid,
          full_name: displayName || `User ${normalizedPhone.slice(-4)}`,
          phone_verified: true,
          is_active: true,
          app_platform: appPlatform,
          last_login_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (insertErr || !inserted) {
        console.error('Customer insert error:', insertErr);
        return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
      }
      customerId = inserted.id;
      isNewCustomer = true;
    }

    let welcomeBonus: {
      credited: boolean;
      amount: number;
      already_credited?: boolean;
      expires_at?: string | null;
    } = {
      credited: false,
      amount: 0,
    };

    try {
      const welcomeResult = await creditWelcomeBonus(supabaseAdmin, customerId);
      if (welcomeResult.credited) {
        welcomeBonus = {
          credited: true,
          amount: Number(welcomeResult.amount || 0),
          expires_at: welcomeResult.expires_at || null,
        };
      } else if (welcomeResult.reason === 'already_credited') {
        welcomeBonus = { credited: false, amount: 0, already_credited: true };
      } else {
        console.warn('[verify-otp] welcome bonus not credited:', welcomeResult);
      }
    } catch (welcomeErr) {
      console.error('[verify-otp] welcome bonus failed:', welcomeErr);
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
      console.error('Session insert error:', sessionErr);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    const cookieStore = await cookies();
    cookieStore.set(getSessionCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: getSessionMaxAgeSeconds(),
      path: '/',
    });

    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id, phone, email, full_name, profile_image, phone_verified, email_verified')
      .eq('id', customerId)
      .single();

    return NextResponse.json({
      success: true,
      customer: customer || { id: customerId, phone: normalizedPhone },
      session_token: token,
      is_new_customer: isNewCustomer,
      welcome_bonus: welcomeBonus,
    });
  } catch (err: any) {
    if (err?.code === 'auth/argument-error' || err?.message?.includes('Decoding Firebase ID token')) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    console.error('Verify OTP error:', err);
    const { supabaseAdmin } = getSupabaseAdmin();
    if (supabaseAdmin) {
      const body = await request.json().catch(() => ({}));
      const attemptedPhone = String(body?.phone || '').replace(/\D/g, '').slice(-10);
      if (attemptedPhone) {
        await supabaseAdmin.from('otp_requests').insert({
          phone: attemptedPhone,
          provider: 'FIREBASE',
          status: 'FAILED',
          channel: 'SMS',
          ip_address: request.headers.get('x-forwarded-for') || null,
          user_agent: request.headers.get('user-agent') || null,
          metadata: { action: 'verify_otp_failed' },
        });
      }
    }
    return NextResponse.json(
      { error: err?.message || 'Verification failed' },
      { status: 500 }
    );
  }
}
