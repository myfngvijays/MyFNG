import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendTemplateMessage } from '@/lib/services/whatsappService';
import type { SessionData } from './session';

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const OTP_EXPIRY_MINUTES = 10;
export const BOOKING_OTP_DRY_RUN_CODE = '000000';

export function normalizeBookingPhone(input: unknown): string {
  return String(input || '').replace(/\D/g, '').slice(-10);
}

export function normalizeBookingOtp(input: unknown): string {
  return String(input || '').replace(/\D/g, '').slice(0, 6);
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isNotExpired(expiresAt: unknown): boolean {
  if (!expiresAt || typeof expiresAt !== 'string') return false;
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs)) return false;
  return expiryMs > Date.now();
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

export function isPhoneVerifiedInSession(session: SessionData | undefined, phone: string): boolean {
  const normalized = normalizeBookingPhone(phone);
  const verified = normalizeBookingPhone(session?.phoneVerification?.phone);
  return Boolean(normalized && verified && normalized === verified && session?.phoneVerification?.verifiedAt);
}

export function markPhoneVerifiedInSession(session: SessionData, phone: string): void {
  session.phoneVerification = {
    phone: normalizeBookingPhone(phone),
    verifiedAt: new Date().toISOString(),
  };
}

export async function sendBookingOtpForPhone(
  phone: string,
  metadata?: Record<string, unknown>,
  opts?: { dryRun?: boolean },
): Promise<{ success: boolean; message?: string; error?: string; expiresInSeconds?: number; dryRun?: boolean }> {
  const normalized = normalizeBookingPhone(phone);
  if (normalized.length !== 10) {
    return { success: false, error: 'Valid 10-digit phone is required' };
  }

  if (opts?.dryRun) {
    return {
      success: true,
      dryRun: true,
      message: `Dry-run: OTP not sent. Ask customer to reply ${BOOKING_OTP_DRY_RUN_CODE} to verify.`,
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
    };
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { success: false, error: 'Server configuration error' };
  }

  const allowed = await checkRateLimit(supabaseAdmin, normalized);
  if (!allowed) {
    return { success: false, error: 'Too many OTP requests. Try later.' };
  }

  const otpCode = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const baseMetadata = metadata && typeof metadata === 'object' ? metadata : {};
  const rowMetadata = {
    ...baseMetadata,
    otp_code: otpCode,
    expires_at: expiresAt,
  };

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('otp_requests')
    .insert({
      phone: normalized,
      provider: 'WHATSAPP',
      status: 'SENT',
      channel: 'WHATSAPP',
      metadata: rowMetadata,
    })
    .select('id')
    .single();

  if (insertError) {
    return { success: false, error: 'Failed to create OTP request' };
  }

  const attempts: Array<{ languageCode: string; templateParams: string[]; buttonUrlParams?: string[] }> = [
    { languageCode: 'en', templateParams: [otpCode], buttonUrlParams: [otpCode] },
    { languageCode: 'en', templateParams: [otpCode] },
    { languageCode: 'en', templateParams: [otpCode, otpCode] },
    { languageCode: 'en_US', templateParams: [otpCode], buttonUrlParams: [otpCode] },
    { languageCode: 'en_US', templateParams: [otpCode] },
    { languageCode: 'en_US', templateParams: [otpCode, otpCode] },
  ];

  let waResult = { success: false, error: 'Unknown WhatsApp error' as string | undefined };
  for (const attempt of attempts) {
    const result = await sendTemplateMessage({
      phoneNumber: normalized,
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
  }

  if (!waResult.success) {
    await supabaseAdmin
      .from('otp_requests')
      .update({
        status: 'FAILED',
        metadata: {
          ...rowMetadata,
          whatsapp_error: waResult.error || 'Unknown WhatsApp error',
        },
      })
      .eq('id', inserted?.id);

    return { success: false, error: waResult.error || 'Failed to send OTP on WhatsApp' };
  }

  return {
    success: true,
    message: 'OTP sent on WhatsApp',
    expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
  };
}

export async function verifyBookingOtpForPhone(
  phone: string,
  otp: string,
  opts?: { dryRun?: boolean },
): Promise<{ verified: boolean; error?: string; dryRun?: boolean }> {
  const normalizedPhone = normalizeBookingPhone(phone);
  const normalizedOtp = normalizeBookingOtp(otp);

  if (normalizedPhone.length !== 10) {
    return { verified: false, error: 'Valid 10-digit phone is required' };
  }
  if (!/^\d{6}$/.test(normalizedOtp)) {
    return { verified: false, error: 'Valid 6-digit OTP is required' };
  }

  if (opts?.dryRun && normalizedOtp === BOOKING_OTP_DRY_RUN_CODE) {
    return { verified: true, dryRun: true };
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { verified: false, error: 'Server configuration error' };
  }

  const { data: requests, error: queryError } = await supabaseAdmin
    .from('otp_requests')
    .select('id, metadata, status, created_at')
    .eq('phone', normalizedPhone)
    .eq('channel', 'WHATSAPP')
    .eq('status', 'SENT')
    .order('created_at', { ascending: false })
    .limit(25);

  if (queryError) {
    return { verified: false, error: 'Failed to verify OTP' };
  }

  const matched = (requests || []).find((row: any) => {
    const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    return String(metadata.otp_code || '') === normalizedOtp && isNotExpired(metadata.expires_at);
  });

  if (!matched?.id) {
    return { verified: false, error: 'Invalid or expired OTP' };
  }

  const currentMetadata =
    matched?.metadata && typeof matched.metadata === 'object' ? matched.metadata : {};
  const { error: updateError } = await supabaseAdmin
    .from('otp_requests')
    .update({
      status: 'VERIFIED',
      metadata: {
        ...currentMetadata,
        verified_at: new Date().toISOString(),
      },
    })
    .eq('id', matched.id);

  if (updateError) {
    return { verified: false, error: 'Failed to finalize OTP verification' };
  }

  return { verified: true };
}
