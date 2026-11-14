import { NextResponse } from 'next/server';
import { emailOtpReady, loadOtpChannelConfig } from '@/lib/otp/channelConfig';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await loadOtpChannelConfig();
  return NextResponse.json({
    sms_dlt: config.sms_dlt,
    firebase: config.firebase,
    whatsapp: config.whatsapp,
    email: emailOtpReady(config),
  });
}
