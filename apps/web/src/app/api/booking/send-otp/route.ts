import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { issueSmsOtp, normalizeSmsPhone } from '@/lib/sms/issueSmsOtp';
import { sendWhatsAppOtpMessage } from '@/lib/services/whatsappOtpSend';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const phone = normalizeSmsPhone(body.phone);
  if (phone.length !== 10) {
    return NextResponse.json({ error: 'Valid phone is required' }, { status: 400 });
  }

  const requested = String(body.channel || 'SMS').trim().toUpperCase();
  const channel = requested === 'WHATSAPP' ? 'WHATSAPP' : 'SMS';
  const baseMetadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

  if (channel === 'WHATSAPP') {
    const result = await issueWhatsAppBookingOtp(supabaseAdmin, phone, {
      metadata: baseMetadata,
      ip: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      message: 'OTP sent on WhatsApp',
      channel: 'WHATSAPP',
      expiresInSeconds: result.expiresInSeconds,
    });
  }

  const result = await issueSmsOtp(supabaseAdmin, phone, {
    metadata: baseMetadata,
    ip: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });

  const fallbackWhatsapp = body.fallbackWhatsapp === true || body.fallback_whatsapp === true;
  if (!result.ok && fallbackWhatsapp) {
    const wa = await issueWhatsAppBookingOtp(supabaseAdmin, phone, {
      metadata: baseMetadata,
      ip: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });
    if (wa.ok) {
      return NextResponse.json({
        success: true,
        message: 'OTP sent on WhatsApp',
        channel: 'WHATSAPP',
        fallback: true,
        expiresInSeconds: wa.expiresInSeconds,
      });
    }
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    message: 'OTP sent by SMS',
    channel: 'SMS',
    expiresInSeconds: result.expiresInSeconds,
  });
}

const WA_WINDOW_MINUTES = 15;
const WA_MAX_ATTEMPTS = 5;
const WA_OTP_EXPIRY_MINUTES = 10;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function issueWhatsAppBookingOtp(
  supabaseAdmin: any,
  phone: string,
  opts: {
    metadata?: Record<string, unknown>;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<{ ok: true; expiresInSeconds: number } | { ok: false; status: number; error: string }> {
  const windowStart = new Date(Date.now() - WA_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from('otp_requests')
    .select('id')
    .eq('phone', phone)
    .eq('channel', 'WHATSAPP')
    .gte('created_at', windowStart);

  if ((recent || []).length >= WA_MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: 'Too many OTP requests. Try later.' };
  }

  const otpCode = generateOtp();
  const expiresAt = new Date(Date.now() + WA_OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const metadata = {
    ...(opts.metadata || {}),
    otp_code: otpCode,
    expires_at: expiresAt,
  };

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('otp_requests')
    .insert({
      phone,
      provider: 'WHATSAPP',
      status: 'SENT',
      channel: 'WHATSAPP',
      ip_address: opts.ip || null,
      user_agent: opts.userAgent || null,
      metadata,
    })
    .select('id')
    .single();

  if (insertError || !inserted?.id) {
    return { ok: false, status: 500, error: 'Failed to create OTP request' };
  }

  const waResult = await sendWhatsAppOtpMessage(phone, otpCode);
  if (!waResult.success) {
    await supabaseAdmin
      .from('otp_requests')
      .update({
        status: 'FAILED',
        metadata: {
          ...metadata,
          whatsapp_error: waResult.error || 'Unknown WhatsApp error',
        },
      })
      .eq('id', inserted.id);
    return { ok: false, status: 502, error: waResult.error || 'Failed to send OTP on WhatsApp' };
  }

  return { ok: true, expiresInSeconds: WA_OTP_EXPIRY_MINUTES * 60 };
}
