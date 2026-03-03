import { NextRequest, NextResponse } from 'next/server';
import { assertInternalAsteriskAuth, signalingConfigState } from '@/app/api/internal/asterisk/_shared';

export async function GET(request: NextRequest) {
  const auth = assertInternalAsteriskAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    success: true,
    status: 'ok',
    signaling: signalingConfigState(),
    full_signaling_enabled: String(process.env.WHATSAPP_CALLING_FULL_SIGNALING || '').trim() === '1',
  });
}
