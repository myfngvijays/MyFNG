import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  ensureWebsiteOtpVerifiedLead,
  resolveOtpLeadOptionsFromSource,
} from '@/lib/service-lead-reopen';

export const dynamic = 'force-dynamic';

const EXTERNAL_AUTOUPDATE_URL =
  'https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead';
const EXTERNAL_AUTOUPDATE_BEARER =
  '398fc0c7-ee90-4992-b214-4063f9f7ad031727771960659:e9580bb4-cb6f-47ff-81fb-847e5a98a5a2';

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

async function pushOtpVerifiedToTeleCRM(phone: string, leadSourceLabel: string) {
  const payload = {
    fields: {
      Name: `Customer_${phone.slice(-4)}`,
      Phone: `+91${phone}`,
      LEADTAG: leadSourceLabel.toUpperCase().includes('MISA') ? 'MISA' : 'WEBSITE',
      LeadSource: leadSourceLabel,
      LeadStatus: 'OTP_VERIFIED',
      CreatedFrom: 'WEB',
      CreatedAt: new Date().toISOString(),
    },
    actions: [
      {
        type: 'SYSTEM_NOTE',
        text: `Lead Source: ${leadSourceLabel}`,
      },
    ],
  };

  const res = await fetch(EXTERNAL_AUTOUPDATE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${EXTERNAL_AUTOUPDATE_BEARER}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const responseBody = await res.text().catch(() => '');

  if (!res.ok) {
    throw new Error(`TeleCRM push failed: ${res.status} ${responseBody || ''}`.trim());
  }

  if (responseBody) {
    console.info('[verify-otp] TeleCRM sync response:', responseBody);
  }
}

export async function POST(request: NextRequest) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  const otp = normalizeOtp(body.otp);
  const mobileHeader = String(request.headers.get('x-mobile-client') || '').toLowerCase();
  const bodyChannel = String(body.channel || body.source || '').toUpperCase();
  const otpChannel: 'WEB' | 'MOBILE' =
    bodyChannel === 'MOBILE' ||
    bodyChannel === 'MOBILE_APP' ||
    bodyChannel === 'APP' ||
    mobileHeader === 'true' ||
    mobileHeader === '1'
      ? 'MOBILE'
      : 'WEB';

  if (phone.length !== 10) {
    return NextResponse.json({ verified: false, error: 'Valid phone is required' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(otp)) {
    return NextResponse.json({ verified: false, error: 'Valid 6-digit OTP is required' }, { status: 400 });
  }

  const { data: requests, error: queryError } = await supabaseAdmin
    .from('otp_requests')
    .select('id, metadata, status, created_at')
    .eq('phone', phone)
    .eq('channel', 'WHATSAPP')
    .eq('status', 'SENT')
    .order('created_at', { ascending: false })
    .limit(25);

  if (queryError) {
    return NextResponse.json({ verified: false, error: 'Failed to verify OTP' }, { status: 500 });
  }

  const matched = (requests || []).find((row: any) => {
    const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    return String(metadata.otp_code || '') === otp && isNotExpired(metadata.expires_at);
  });

  if (!matched?.id) {
    return NextResponse.json({ verified: false, error: 'Invalid or expired OTP' }, { status: 400 });
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
    return NextResponse.json({ verified: false, error: 'Failed to finalize OTP verification' }, { status: 500 });
  }

  const metaSource =
    String(body.source || body.lead_source || (currentMetadata as any).source || '').trim() || null;
  const metaBookingChannel =
    String(body.misa_channel || (currentMetadata as any).channel || '').trim() || null;
  const leadOpts = resolveOtpLeadOptionsFromSource({
    source: metaSource,
    bookingChannel: metaBookingChannel,
    sessionId: String((currentMetadata as any).session_id || body.session_id || ''),
    fallbackChannel: otpChannel,
  });

  // MyFNG incomplete lead → admin bookings + telecaller CRM (incl. MISA OTP abandon)
  let myfngLead: Awaited<ReturnType<typeof ensureWebsiteOtpVerifiedLead>> | null = null;
  try {
    myfngLead = await ensureWebsiteOtpVerifiedLead(supabaseAdmin, phone, leadOpts);
    console.info('[verify-otp] MyFNG OTP lead result', {
      phone,
      channel: leadOpts.channel,
      origin: leadOpts.origin,
      misaChannel: leadOpts.misaChannel || null,
      created: myfngLead.created,
      lead_number: myfngLead.leadNumber,
      lead_id: myfngLead.leadId,
      skipped: myfngLead.skipped || null,
    });
  } catch (err) {
    console.error('[verify-otp] MyFNG incomplete lead failed (non-blocking):', err);
  }

  const telecrmLabel =
    leadOpts.origin === 'misa'
      ? leadOpts.misaChannel === 'APP'
        ? 'MISA AI (App)'
        : leadOpts.misaChannel === 'WHATSAPP'
          ? 'WhatsApp MISA AI'
          : 'MISA AI (Website)'
      : otpChannel === 'MOBILE'
        ? 'App Booking'
        : 'Website';

  pushOtpVerifiedToTeleCRM(phone, telecrmLabel).catch((err) => {
    console.error('[verify-otp] TeleCRM sync failed (non-blocking):', err);
  });

  return NextResponse.json({
    verified: true,
    lead_id: myfngLead?.leadId || null,
    lead_number: myfngLead?.leadNumber || null,
  });
}
