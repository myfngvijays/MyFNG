import { sendWhySmsOtp } from '@/lib/dlt-sms/send';

export const SMS_OTP_WINDOW_MINUTES = 15;
export const SMS_OTP_MAX_ATTEMPTS = 5;
export const SMS_OTP_EXPIRY_MINUTES = 5;

export function normalizeSmsPhone(input: unknown): string {
  return String(input || '').replace(/\D/g, '').slice(-10);
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function issueSmsOtp(
  supabaseAdmin: any,
  phone: string,
  opts: {
    metadata?: Record<string, unknown>;
    ip?: string | null;
    userAgent?: string | null;
  } = {},
): Promise<
  | { ok: true; expiresInSeconds: number }
  | { ok: false; status: number; error: string }
> {
  const windowStart = new Date(Date.now() - SMS_OTP_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from('otp_requests')
    .select('id')
    .eq('phone', phone)
    .eq('channel', 'SMS')
    .gte('created_at', windowStart);

  if ((recent || []).length >= SMS_OTP_MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: 'Too many OTP requests. Try later.' };
  }

  const otpCode = generateOtp();
  const expiresAt = new Date(Date.now() + SMS_OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const metadata = {
    ...(opts.metadata || {}),
    otp_code: otpCode,
    expires_at: expiresAt,
  };

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('otp_requests')
    .insert({
      phone,
      provider: 'WHYSMS',
      status: 'SENT',
      channel: 'SMS',
      ip_address: opts.ip || null,
      user_agent: opts.userAgent || null,
      metadata,
    })
    .select('id')
    .single();

  if (insertError || !inserted?.id) {
    return { ok: false, status: 500, error: 'Failed to create OTP request' };
  }

  const sent = await sendWhySmsOtp(phone, otpCode);
  if (!sent.ok) {
    await supabaseAdmin
      .from('otp_requests')
      .update({
        status: 'FAILED',
        metadata: {
          ...metadata,
          sms_error: sent.detail || sent.error || 'SMS send failed',
        },
      })
      .eq('id', inserted.id);
    return { ok: false, status: 502, error: sent.error || 'Failed to send SMS OTP' };
  }

  return { ok: true, expiresInSeconds: SMS_OTP_EXPIRY_MINUTES * 60 };
}
