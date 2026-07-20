import { assertPushAdmin } from '@/lib/push/admin-auth';
import { checkFcmCredentials } from '@/lib/push/fcmHealthCheck';
import {
  loadPushFirebaseConfigView,
  savePushFirebaseConfig,
} from '@/lib/push/firebaseConfigStore';
import { resetFirebaseAdminApp } from '@/lib/firebase/admin';
import { getMobileAuthConfig, saveMobileSmsOtpEnabled, clearMobileAuthConfigCache } from '@/lib/mobile-auth-config';
import {
  loadProductAnalyticsConfig,
  updateMobileFirebaseAnalyticsFlags,
} from '@/lib/analytics/productAnalyticsConfig';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const [config, health, mobileAuth, analyticsConfig] = await Promise.all([
      loadPushFirebaseConfigView(),
      checkFcmCredentials(),
      getMobileAuthConfig(supabaseAdmin),
      loadProductAnalyticsConfig(supabaseAdmin),
    ]);

    return NextResponse.json({
      config,
      features: {
        sms_otp_enabled: mobileAuth.sms_otp_enabled,
        firebase_analytics_android: analyticsConfig.platforms.android.firebase_analytics_enabled,
        firebase_analytics_ios: analyticsConfig.platforms.ios.firebase_analytics_enabled,
      },
      health: {
        ok: health.ok,
        message: health.message || health.error || null,
        credentials_source: health.credentialsSource,
      },
      can_edit: auth.roleCode === 'SUPER_ADMIN',
      protocol: 'FCM HTTP v1',
      version: '1.0',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (auth.roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only Super Admin can edit Firebase credentials' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const result = await savePushFirebaseConfig(body, auth.userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const features = body?.features;
    if (features && typeof features === 'object') {
      if (typeof features.sms_otp_enabled === 'boolean') {
        const smsResult = await saveMobileSmsOtpEnabled(features.sms_otp_enabled, auth.userId);
        if (!smsResult.ok) {
          return NextResponse.json({ error: smsResult.error }, { status: 500 });
        }
      }

      const analyticsPatch: { android?: boolean; ios?: boolean } = {};
      if (typeof features.firebase_analytics_android === 'boolean') {
        analyticsPatch.android = features.firebase_analytics_android;
      }
      if (typeof features.firebase_analytics_ios === 'boolean') {
        analyticsPatch.ios = features.firebase_analytics_ios;
      }
      if (analyticsPatch.android !== undefined || analyticsPatch.ios !== undefined) {
        const analyticsResult = await updateMobileFirebaseAnalyticsFlags(analyticsPatch, auth.userId);
        if (!analyticsResult.ok) {
          return NextResponse.json({ error: analyticsResult.error }, { status: 500 });
        }
      }
    }

    await resetFirebaseAdminApp();
    clearMobileAuthConfigCache();
    const health = await checkFcmCredentials();

    return NextResponse.json({
      success: true,
      message: 'Firebase settings saved',
      health,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function POST() {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await resetFirebaseAdminApp();
    const health = await checkFcmCredentials();
    return NextResponse.json({
      ok: health.ok,
      project_id: health.projectId,
      credentials_source: health.credentialsSource,
      message: health.ok
        ? health.message || 'FCM credentials valid'
        : health.error || 'FCM credential check failed',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
