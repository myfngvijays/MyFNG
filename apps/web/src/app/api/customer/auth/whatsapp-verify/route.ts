import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  generateSessionToken,
  getSessionCookieName,
  getSessionMaxAgeSeconds,
} from '@/lib/customer-session';
import { creditWelcomeBonus } from '@/lib/wallet-service';
import { resolveAppPlatformFromRequest } from '@/lib/app-platform';
import {
  customerAccountBlockMessage,
  isCustomerAccountBlocked,
  resolveCustomerAccountStatus,
} from '@/lib/customer-account-admin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

function normalizePhone(input: unknown): string {
  return String(input || '').replace(/\D/g, '').slice(-10);
}

function normalizeOtp(input: unknown): string {
  return String(input || '').replace(/\D/g, '').slice(0, 6);
}

function isNotExpired(expiresAt: unknown): boolean {
  if (!expiresAt || typeof expiresAt !== 'string') return false;
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs)) return false;
  return expiryMs > Date.now();
}

export async function POST(request: NextRequest) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  const otp = normalizeOtp(body.otp);
  const otpChannel = String(body?.channel || 'WHATSAPP').toUpperCase() === 'SMS' ? 'SMS' : 'WHATSAPP';
  const displayName =
    typeof body?.displayName === 'string' ? String(body.displayName).trim() || null : null;
  const appPlatform = resolveAppPlatformFromRequest(request, body?.platform);

  if (phone.length !== 10) {
    return NextResponse.json({ error: 'Valid phone is required' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(otp)) {
    return NextResponse.json({ error: 'Valid 6-digit OTP is required' }, { status: 400 });
  }

  const { data: requests, error: queryError } = await supabaseAdmin
    .from('otp_requests')
    .select('id, metadata, status, created_at')
    .eq('phone', phone)
    .eq('channel', otpChannel)
    .eq('status', 'SENT')
    .order('created_at', { ascending: false })
    .limit(25);

  if (queryError) {
    return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 });
  }

  const matched = (requests || []).find((row: any) => {
    const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    return String(metadata.otp_code || '') === otp && isNotExpired(metadata.expires_at);
  });

  if (!matched?.id) {
    return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
  }

  const currentMetadata =
    matched?.metadata && typeof matched.metadata === 'object' ? matched.metadata : {};
  const { error: updateOtpError } = await supabaseAdmin
    .from('otp_requests')
    .update({
      status: 'VERIFIED',
      metadata: {
        ...currentMetadata,
        verified_at: new Date().toISOString(),
      },
    })
    .eq('id', matched.id);

  if (updateOtpError) {
    return NextResponse.json({ error: 'Failed to finalize OTP verification' }, { status: 500 });
  }

  let customerId: string;
  let isNewCustomer = false;
  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('id, full_name, is_active, account_status')
    .eq('phone', phone)
    .maybeSingle();

  if (existing && isCustomerAccountBlocked(existing.is_active, existing.account_status)) {
    const status = resolveCustomerAccountStatus(existing.account_status, existing.is_active);
    return NextResponse.json({ error: customerAccountBlockMessage(status) }, { status: 403 });
  }

  if (existing) {
    customerId = existing.id;
    const updatePayload: Record<string, unknown> = {
      phone_verified: true,
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (displayName && !existing.full_name) {
      updatePayload.full_name = displayName;
    }
    if (appPlatform) updatePayload.app_platform = appPlatform;
    await supabaseAdmin.from('customers').update(updatePayload).eq('id', customerId);
  } else {
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('customers')
      .insert({
        phone,
        full_name: displayName || `User ${phone.slice(-4)}`,
        phone_verified: true,
        is_active: true,
        app_platform: appPlatform,
        last_login_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (insertErr || !inserted) {
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
    const welcomeResult = isNewCustomer
      ? await creditWelcomeBonus(supabaseAdmin, customerId)
      : { credited: false as const, reason: 'not_eligible' as const };
    if (welcomeResult.credited) {
      welcomeBonus = {
        credited: true,
        amount: Number(welcomeResult.amount || 0),
        expires_at: welcomeResult.expires_at || null,
      };
    } else if (welcomeResult.reason === 'already_credited') {
      welcomeBonus = { credited: false, amount: 0, already_credited: true };
    } else {
      console.warn('[whatsapp-verify] welcome bonus not credited:', welcomeResult);
    }
  } catch (welcomeErr) {
    console.error('[whatsapp-verify] welcome bonus failed:', welcomeErr);
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
    customer: customer || { id: customerId, phone },
    session_token: token,
    is_new_customer: isNewCustomer,
    welcome_bonus: welcomeBonus,
  });
}
