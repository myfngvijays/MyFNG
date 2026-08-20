import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendWhatsAppOtpMessage } from '@/lib/services/whatsappOtpSend';
import {
  ensureWebsiteOtpVerifiedLead,
  resolveOtpLeadOptionsFromSource,
} from '@/lib/service-lead-reopen';
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

  const waResult = await sendWhatsAppOtpMessage(normalized, otpCode);

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
  opts?: { dryRun?: boolean; createLead?: boolean },
): Promise<{
  verified: boolean;
  error?: string;
  dryRun?: boolean;
  leadId?: string | null;
  leadNumber?: string | null;
}> {
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

  // Incomplete CRM lead even if booking is abandoned (MISA chat / WhatsApp / tools).
  let leadId: string | null = null;
  let leadNumber: string | null = null;
  if (opts?.createLead !== false) {
    try {
      const leadOpts = resolveOtpLeadOptionsFromSource({
        source: String((currentMetadata as any).source || 'misa_booking'),
        bookingChannel: String((currentMetadata as any).channel || ''),
        sessionId: String((currentMetadata as any).session_id || ''),
        fallbackChannel: 'WEB',
      });
      // Tool OTP is always MISA-origin when source missing.
      // Delivery is WhatsApp — default WA 6161 when channel/session still unknown.
      if (leadOpts.origin !== 'misa') {
        leadOpts.origin = 'misa';
        leadOpts.misaChannel = leadOpts.misaChannel || 'WHATSAPP';
        leadOpts.channel = leadOpts.misaChannel === 'APP' ? 'MOBILE' : 'WEB';
      } else if (!leadOpts.misaChannel) {
        leadOpts.misaChannel = 'WHATSAPP';
      }
      const myfngLead = await ensureWebsiteOtpVerifiedLead(supabaseAdmin, normalizedPhone, leadOpts);
      leadId = myfngLead.leadId;
      leadNumber = myfngLead.leadNumber;
      console.info('[verifyBookingOtpForPhone] OTP incomplete lead', {
        phone: normalizedPhone,
        created: myfngLead.created,
        lead_number: leadNumber,
        skipped: myfngLead.skipped || null,
      });
    } catch (err) {
      console.error('[verifyBookingOtpForPhone] incomplete lead failed (non-blocking):', err);
    }
  }

  return { verified: true, leadId, leadNumber };
}
