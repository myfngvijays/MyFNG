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
  const baseMetadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
  const metadata = {
    ...baseMetadata,
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
      ip_address: request.headers.get('x-forwarded-for') || null,
      user_agent: request.headers.get('user-agent') || null,
      metadata,
    })
    .select('id')
    .single();

  if (insertError) {
    return NextResponse.json({ error: 'Failed to create OTP request' }, { status: 500 });
  }

  const attempts: Array<{ languageCode: string; templateParams: string[]; buttonUrlParams?: string[] }> = [
    { languageCode: 'en', templateParams: [otpCode], buttonUrlParams: [otpCode] },
    { languageCode: 'en', templateParams: [otpCode] },
    { languageCode: 'en', templateParams: [otpCode, otpCode] },
    { languageCode: 'en_US', templateParams: [otpCode], buttonUrlParams: [otpCode] },
    { languageCode: 'en_US', templateParams: [otpCode] },
    { languageCode: 'en_US', templateParams: [otpCode, otpCode] },
  ];

  let waResult = { success: false, error: 'Unknown WhatsApp error', raw: null as unknown, statusCode: undefined as number | undefined };
  const attemptErrors: Array<{ languageCode: string; paramsCount: number; error?: string; statusCode?: number; raw?: unknown }> = [];

  for (const attempt of attempts) {
    const result = await sendTemplateMessage({
      phoneNumber: phone,
      templateName: 'otp',
      templateParams: attempt.templateParams,
      buttonUrlParams: attempt.buttonUrlParams,
      languageCode: attempt.languageCode,
    });
    if (result.success) {
      waResult = result;
      break;
    }

    waResult = result;
    attemptErrors.push({
      languageCode: attempt.languageCode,
      paramsCount: attempt.templateParams.length,
      buttonParamsCount: attempt.buttonUrlParams?.length || 0,
      error: result.error,
      statusCode: result.statusCode,
      raw: result.raw,
    });
  }

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
          whatsapp_attempts: attemptErrors,
        },
      })
      .eq('id', inserted?.id);

    console.error('[booking/send-otp] WhatsApp send failed', {
      phone,
      statusCode: waResult.statusCode,
      error: waResult.error,
      raw: waResult.raw,
      attempts: attemptErrors,
    });

    return NextResponse.json(
      {
        error: waResult.error || 'Failed to send OTP on WhatsApp',
        details: waResult.raw || null,
        attempts: attemptErrors,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'OTP sent on WhatsApp',
    expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
  });
}
