import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { issueSmsOtp, normalizeSmsPhone } from '@/lib/sms/issueSmsOtp';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const phone = normalizeSmsPhone(body.phone);
  if (phone.length !== 10) return NextResponse.json({ error: 'Valid phone is required' }, { status: 400 });

  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
  const result = await issueSmsOtp(supabaseAdmin, phone, {
    metadata: { ...metadata, source: metadata.source || 'customer_auth_login' },
    ip: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    provider: 'WHYSMS',
    channel: 'SMS',
    message: 'OTP sent by SMS',
    expiresInSeconds: result.expiresInSeconds,
  });
}
