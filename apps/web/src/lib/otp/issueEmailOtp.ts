import { emailOtpReady, loadOtpChannelConfig } from '@/lib/otp/channelConfig';
import { sendSmtpMail } from '@/lib/otp/smtpSend';

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const EXPIRY_MINUTES = 10;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function normalizeOtpEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email.slice(0, 180);
}

export async function issueEmailOtp(
  supabaseAdmin: any,
  phone: string,
  email: string,
  opts: { metadata?: Record<string, unknown>; ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true; expiresInSeconds: number } | { ok: false; status: number; error: string }> {
  const config = await loadOtpChannelConfig();
  if (!config.email) {
    return { ok: false, status: 403, error: 'Email OTP is turned off.' };
  }
  if (!emailOtpReady(config)) {
    return { ok: false, status: 400, error: 'Email OTP mailbox is not configured yet.' };
  }
  const to = normalizeOtpEmail(email);
  if (!to) return { ok: false, status: 400, error: 'Enter a valid email address.' };

  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from('otp_requests')
    .select('id')
    .eq('phone', phone)
    .eq('channel', 'EMAIL')
    .gte('created_at', windowStart);
  if ((recent || []).length >= MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: 'Too many OTP requests. Try later.' };
  }

  const otpCode = generateOtp();
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString();
  const metadata = {
    ...(opts.metadata || {}),
    otp_code: otpCode,
    expires_at: expiresAt,
    email: to,
  };
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('otp_requests')
    .insert({
      phone,
      provider: 'EMAIL',
      status: 'SENT',
      channel: 'EMAIL',
      ip_address: opts.ip || null,
      user_agent: opts.userAgent || null,
      metadata,
    })
    .select('id')
    .single();
  if (insertError || !inserted?.id) {
    return { ok: false, status: 500, error: 'Failed to create OTP request' };
  }

  try {
    await sendSmtpMail(
      {
        host: config.email_host,
        port: config.email_port,
        user: config.email_user,
        pass: config.email_pass,
        secure: config.email_secure,
        from: config.email_from,
        fromName: config.email_from_name || 'MyFNG',
      },
      {
        to,
        subject: 'Your MyFNG verification code',
        text: `${otpCode} is your MyFNG verification code. It expires in ${EXPIRY_MINUTES} minutes. Do not share this code.`,
      },
    );
  } catch (error: any) {
    await supabaseAdmin
      .from('otp_requests')
      .update({
        status: 'FAILED',
        metadata: { ...metadata, email_error: String(error?.message || 'Email send failed').slice(0, 240) },
      })
      .eq('id', inserted.id);
    return { ok: false, status: 502, error: String(error?.message || 'Failed to send email OTP') };
  }

  return { ok: true, expiresInSeconds: EXPIRY_MINUTES * 60 };
}
