import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 5;

async function checkRateLimit(supabaseAdmin: any, phone: string) {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from('otp_requests')
    .select('id')
    .eq('phone', phone)
    .gte('created_at', windowStart);
  return (data || []).length < MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const phone = String(body.phone || '').replace(/\D/g, '').slice(-10);
  if (phone.length !== 10) return NextResponse.json({ error: 'Valid phone is required' }, { status: 400 });

  const allowed = await checkRateLimit(supabaseAdmin, phone);
  if (!allowed) return NextResponse.json({ error: 'Too many OTP requests. Try later.' }, { status: 429 });

  await supabaseAdmin.from('otp_requests').insert({
    phone,
    provider: 'FIREBASE',
    status: 'SENT',
    channel: 'SMS',
    ip_address: request.headers.get('x-forwarded-for') || null,
    user_agent: request.headers.get('user-agent') || null,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  });

  // Firebase OTP is sent from client SDK (Recaptcha + signInWithPhoneNumber).
  return NextResponse.json({
    success: true,
    provider: 'FIREBASE',
    message: 'Proceed with Firebase signInWithPhoneNumber on client',
  });
}

