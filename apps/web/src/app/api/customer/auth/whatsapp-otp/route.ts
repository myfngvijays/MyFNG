import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendTemplateMessage } from '@/lib/services/whatsappService';

export const dynamic = 'force-dynamic';

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const OTP_EXPIRY_MINUTES = 10;

function normalizePhone(input: unknown): string {
  return String(input || '').replace(/\D/g, '').slice(-10);
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function checkRateLimit(supabaseAdmin: any, phone: string) {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from('otp_requests')
    .select('id')
    .eq('phone', phone)
    .eq('channel', 'WHATSAPP')
    .gte('created_at', windowStart);
  return (data || []).length < MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  if (phone.length !== 10) {
    return NextResponse.json({ error: 'Valid phone is required' }, { status: 400 });
  }

  const allowed = await checkRateLimit(supabaseAdmin, phone);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many OTP requests. Try later.' }, { status: 429 });
  }

  const otpCode = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const metadata = {
    otp_code: otpCode,
    expires_at: expiresAt,
    source: 'customer_auth_login',
  };

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('otp_requests')
    .insert({
      phone,
      provider: 'WHATSAPP',
      status: 'SENT',
      channel: 'WHATSAPP',
      ip_address: request.headers.get('x-forwarded-for') || null,
      user_agent: request.headers.get('user-agent') || null,
      metadata,
    })
    .select('id')
    .single();

  if (insertError) {
    return NextResponse.json({ error: 'Failed to create OTP request' }, { status: 500 });
  }

  const waResult = await sendTemplateMessage({
    phoneNumber: phone,
    templateName: 'otp',
    templateParams: [otpCode],
    buttonUrlParams: [otpCode],
    languageCode: 'en',
  });

  if (!waResult.success) {
    await supabaseAdmin
      .from('otp_requests')
      .update({
        status: 'FAILED',
        metadata: {
          ...metadata,
          whatsapp_error: waResult.error || 'Unknown WhatsApp error',
          whatsapp_status_code: waResult.statusCode || null,
          whatsapp_raw: waResult.raw || null,
        },
      })
      .eq('id', inserted?.id);

    return NextResponse.json(
      { error: waResult.error || 'Failed to send OTP on WhatsApp' },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'OTP sent on WhatsApp',
    expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
  });
}
