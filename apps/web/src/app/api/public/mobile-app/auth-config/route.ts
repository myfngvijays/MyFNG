import {
  getMobileAppFirebaseConfig,
  type MobileAppPlatform,
} from '@/lib/mobile-auth-config';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function resolvePlatform(request: NextRequest): MobileAppPlatform {
  const raw = String(
    request.headers.get('x-app-platform') ||
      request.nextUrl.searchParams.get('platform') ||
      'android',
  )
    .trim()
    .toLowerCase();
  return raw === 'ios' ? 'ios' : 'android';
}

export async function GET(request: NextRequest) {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    const platform = resolvePlatform(request);
    const config = await getMobileAppFirebaseConfig(platform, supabaseAdmin);

    return NextResponse.json({
      success: true,
      platform,
      sms_otp_enabled: config.sms_otp_enabled,
      sms_otp_disabled_message: config.sms_otp_disabled_message,
      firebase_analytics_enabled: config.firebase_analytics_enabled,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
